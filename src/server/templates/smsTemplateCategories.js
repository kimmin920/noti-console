import { createHash } from 'node:crypto';

const SMS_TEMPLATE_CATEGORY_PAGE_SIZE = 1000;
const SMS_TEMPLATE_CATEGORY_MAX_PAGES = 50;
const SMS_TEMPLATE_CATEGORY_ROOT_PARENT_ID = 0;
const SMS_TEMPLATE_CATEGORY_NAME_MAX_LENGTH = 50;
const SMS_TEMPLATE_CATEGORY_DESC_MAX_LENGTH = 100;
const SMS_TEMPLATE_PROVIDER_ROOT_CATEGORY_NAME = 'Category';

export const SMS_TEMPLATE_ROOT_CATEGORY_NAME = 'NOTI';
export const SMS_TEMPLATE_ROOT_CATEGORY_DESC = 'Messaging App notifications';

export async function ensureSmsTemplateCategoryForUser({ smsClient, user }) {
  const userCategoryName = buildSmsTemplateUserCategoryName(user);
  let categories = await listAllSmsTemplateCategories(smsClient);
  const rootCategoryParentId = resolveSmsTemplateRootCategoryParentId(categories);
  const rootCategory = await findOrCreateSmsTemplateCategory({
    categories,
    categoryDesc: SMS_TEMPLATE_ROOT_CATEGORY_DESC,
    categoryName: SMS_TEMPLATE_ROOT_CATEGORY_NAME,
    categoryParentId: rootCategoryParentId,
    matchAnyParent: true,
    smsClient,
  });

  categories = categories.some((category) => category.categoryId === rootCategory.categoryId)
    ? categories
    : [...categories, rootCategory];

  return findOrCreateSmsTemplateCategory({
    categories,
    categoryDesc: buildSmsTemplateUserCategoryDesc(user),
    categoryName: userCategoryName,
    categoryParentId: rootCategory.categoryId,
    smsClient,
  });
}

export function buildSmsTemplateUserCategoryName(user = {}) {
  const rawSegment = normalizeCategoryNameSegment(user.userRef || user.id || 'unknown');
  const categoryName = rawSegment;

  if (categoryName.length <= SMS_TEMPLATE_CATEGORY_NAME_MAX_LENGTH) {
    return categoryName;
  }

  const digest = createHash('sha256').update(categoryName).digest('hex').slice(0, 12);
  const prefixLength = SMS_TEMPLATE_CATEGORY_NAME_MAX_LENGTH - digest.length - 2;

  return `${categoryName.slice(0, prefixLength)}_${digest}`;
}

function buildSmsTemplateUserCategoryDesc(user = {}) {
  const rawSegment = normalizeCategoryNameSegment(user.userRef || user.id || 'unknown');
  return truncateText(`Messaging App user ${rawSegment}`, SMS_TEMPLATE_CATEGORY_DESC_MAX_LENGTH);
}

async function findOrCreateSmsTemplateCategory({
  categories,
  categoryDesc,
  categoryName,
  categoryParentId,
  matchAnyParent = false,
  smsClient,
}) {
  const existingCategory = matchAnyParent
    ? findSmsTemplateCategoryByName(categories, categoryName)
    : findSmsTemplateCategory(categories, { categoryName, categoryParentId });

  if (existingCategory) {
    return ensureSmsTemplateCategoryActive({
      category: existingCategory,
      categoryDesc,
      categoryName,
      smsClient,
    });
  }

  try {
    const createPayload = {
      categoryName,
      categoryDesc,
      useYn: 'Y',
      createUser: 'messaging-app',
    };

    if (categoryParentId !== undefined && categoryParentId !== null) {
      createPayload.categoryParentId = categoryParentId;
    }

    const response = await smsClient.createCategory(createPayload);
    return extractSmsTemplateCategory(response);
  } catch (error) {
    const latestCategories = await listAllSmsTemplateCategories(smsClient);
    const concurrentCategory = matchAnyParent
      ? findSmsTemplateCategoryByName(latestCategories, categoryName)
      : findSmsTemplateCategory(latestCategories, { categoryName, categoryParentId });

    if (concurrentCategory) {
      return concurrentCategory;
    }

    throw error;
  }
}

async function ensureSmsTemplateCategoryActive({ category, categoryDesc, categoryName, smsClient }) {
  if (category.useYn === 'Y') {
    return category;
  }

  const response = await smsClient.updateCategory({
    categoryId: category.categoryId,
    categoryName,
    categoryDesc,
    useYn: 'Y',
    updateUser: 'messaging-app',
  });
  const updatedCategory = extractOptionalSmsTemplateCategory(response);

  return updatedCategory ?? {
    ...category,
    categoryDesc,
    useYn: 'Y',
  };
}

async function listAllSmsTemplateCategories(smsClient) {
  const categories = [];
  let totalCount = 0;

  for (let pageNum = 1; pageNum <= SMS_TEMPLATE_CATEGORY_MAX_PAGES; pageNum += 1) {
    const response = await smsClient.listCategories({
      pageNum,
      pageSize: SMS_TEMPLATE_CATEGORY_PAGE_SIZE,
    });
    const page = extractSmsTemplateCategoryPage(response);
    categories.push(...page.categories);
    totalCount = Math.max(totalCount, page.totalCount);

    if (categories.length >= totalCount || page.categories.length < SMS_TEMPLATE_CATEGORY_PAGE_SIZE) {
      break;
    }
  }

  return categories;
}

function extractSmsTemplateCategoryPage(response = {}) {
  const body = response.body && typeof response.body === 'object' ? response.body : {};
  const data = Array.isArray(body.data) ? body.data : [];

  return {
    categories: data.map(normalizeSmsTemplateCategory).filter(Boolean),
    totalCount: Number(body.totalCount) || data.length,
  };
}

function extractSmsTemplateCategory(response = {}) {
  const category = extractOptionalSmsTemplateCategory(response);

  if (!category) {
    throw new Error('NHN SMS category response did not include category data.');
  }

  return category;
}

function extractOptionalSmsTemplateCategory(response = {}) {
  const body = response.body && typeof response.body === 'object' ? response.body : {};
  const rawCategory = Array.isArray(body.data) ? body.data[0] : body.data;
  return normalizeSmsTemplateCategory(rawCategory);
}

function normalizeSmsTemplateCategory(category) {
  if (!category || typeof category !== 'object') {
    return null;
  }

  const categoryId = Number(category.categoryId);
  const categoryParentId = Number(category.categoryParentId ?? SMS_TEMPLATE_CATEGORY_ROOT_PARENT_ID);
  const categoryName = normalizeText(category.categoryName);

  if (!Number.isInteger(categoryId) || categoryId < 1 || !categoryName) {
    return null;
  }

  return {
    categoryId,
    categoryParentId: Number.isInteger(categoryParentId) && categoryParentId >= 0
      ? categoryParentId
      : SMS_TEMPLATE_CATEGORY_ROOT_PARENT_ID,
    categoryName,
    categoryDesc: normalizeText(category.categoryDesc),
    useYn: normalizeText(category.useYn),
  };
}

function findSmsTemplateCategory(categories, { categoryName, categoryParentId }) {
  return categories.find((category) => (
    category.categoryName === categoryName && category.categoryParentId === categoryParentId
  )) ?? null;
}

function findSmsTemplateCategoryByName(categories, categoryName) {
  return categories.find((category) => category.categoryName === categoryName) ?? null;
}

function resolveSmsTemplateRootCategoryParentId(categories) {
  const providerRoot = categories.find((category) => (
    category.categoryParentId === SMS_TEMPLATE_CATEGORY_ROOT_PARENT_ID
    && category.categoryName === SMS_TEMPLATE_PROVIDER_ROOT_CATEGORY_NAME
  )) ?? categories.find((category) => category.categoryParentId === SMS_TEMPLATE_CATEGORY_ROOT_PARENT_ID);

  return providerRoot?.categoryId;
}

function normalizeCategoryNameSegment(value) {
  const normalized = normalizeText(value).replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || 'unknown';
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function truncateText(value, maxLength) {
  return Array.from(value).slice(0, maxLength).join('');
}
