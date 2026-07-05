const SMS_SENDER_RESOURCE_TYPE = 'sms_send_no';

export function getSmsSenderNumberDuplicateIssue({
  currentApplicationId,
  senderResourcesData,
  sendNo,
} = {}) {
  const normalizedSendNo = normalizeSenderNumberInput(sendNo);

  if (!normalizedSendNo) {
    return null;
  }

  const resources = Array.isArray(senderResourcesData?.resources) ? senderResourcesData.resources : [];
  const registeredResource = resources.find((item) => (
    item?.status === 'active'
    && item?.resource?.status === 'active'
    && item?.resource?.type === SMS_SENDER_RESOURCE_TYPE
    && normalizeSenderNumberInput(item.resource.value) === normalizedSendNo
  ));

  if (registeredResource) {
    return {
      type: 'registered',
      message: '이미 등록된 발신번호입니다. 발신 수단 관리에서 바로 사용할 수 있습니다.',
      resourceId: registeredResource.senderResourceId ?? registeredResource.resource?.id ?? registeredResource.id,
    };
  }

  const applications = Array.isArray(senderResourcesData?.applications) ? senderResourcesData.applications : [];
  const submittedApplication = applications.find((application) => (
    application?.id !== currentApplicationId
    && application?.resourceType === SMS_SENDER_RESOURCE_TYPE
    && application?.status === 'submitted'
    && normalizeSenderNumberInput(application.requestedValue) === normalizedSendNo
  ));

  if (submittedApplication) {
    return {
      type: 'submitted',
      message: '이미 신청 중인 발신번호입니다. 심사 결과를 기다리거나 기존 신청을 확인해 주세요.',
      applicationId: submittedApplication.id,
    };
  }

  return null;
}

function normalizeSenderNumberInput(value) {
  return String(value ?? '').replace(/\D/g, '');
}
