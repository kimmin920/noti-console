'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  findPlaygroundComponent,
  getFirstComponentRoute,
  playgroundSections,
} from './componentRegistry.jsx';
import './playground.css';

const harnessRules = [
  'Production builds must not import the playground or its registry.',
  'Every extracted component must be exported from its component module.',
  'Every extracted component must be imported into src/playground/componentRegistry.jsx.',
  'Every extracted component must have exactly one component page in the playground.',
  'Every component page must expose relevant variables in the variables panel.',
  'Do not add invented UI solely for state checking or status verification; playground pages may only expose real component behavior and explicit variables.',
  'After componentization, verify the component page in dev and run npm run build to confirm the playground is excluded.',
];

function getRouteState() {
  if (typeof window === 'undefined') {
    return { mode: 'component', sectionId: null, componentId: null };
  }

  const parts = window.location.pathname.split('/').filter(Boolean);
  const [, sectionId, componentId] = parts;

  if (sectionId === 'harness-rules') {
    return { mode: 'rules', sectionId: null, componentId: null };
  }

  return {
    mode: 'component',
    sectionId,
    componentId,
  };
}

function getDefaultValues(component) {
  return Object.fromEntries(
    (component.controls ?? []).map((control) => [control.id, control.defaultValue])
  );
}

function getControlOptionValue(option) {
  return typeof option === 'object' && option !== null ? option.value : option;
}

function getControlOptionLabel(option) {
  return typeof option === 'object' && option !== null ? option.label : option;
}

function Playground({ initialRoute }) {
  const route = initialRoute ?? getRouteState();

  const { section, component } = useMemo(
    () => findPlaygroundComponent(route.sectionId, route.componentId),
    [route.componentId, route.sectionId]
  );
  const isRulesPage = route.mode === 'rules';

  useEffect(() => {
    if (route.mode === 'component' && (!route.sectionId || !route.componentId)) {
      window.history.replaceState(null, '', getFirstComponentRoute());
    }
  }, [route.componentId, route.mode, route.sectionId]);

  return (
    <div className="playground-page">
      <aside className="playground-nav">
        <div>
          <p className="playground-eyebrow">dev-only</p>
          <h1>UI Playground</h1>
          <p className="playground-description">
            One component per page, with Storybook-like variables.
          </p>
        </div>

        <nav aria-label="Playground components">
          {playgroundSections.map((item) => (
            <div className="playground-nav-group" key={item.id}>
              <p>{item.title}</p>
              {item.components.map((entry) => {
                const active = !isRulesPage && section.id === item.id && component.id === entry.id;
                return (
                  <a
                    aria-current={active ? 'page' : undefined}
                    className={active ? 'active' : ''}
                    href={`/playground/${item.id}/${entry.id}`}
                    key={entry.id}
                  >
                    <span>{entry.name}</span>
                    {entry.tags?.map((tag) => (
                      <span className="playground-component-tag" key={tag}>({tag})</span>
                    ))}
                  </a>
                );
              })}
            </div>
          ))}
          <div className="playground-nav-group">
            <p>Workflow</p>
            <a
              aria-current={isRulesPage ? 'page' : undefined}
              className={isRulesPage ? 'active' : ''}
              href="/playground/harness-rules"
            >
              Harness rules
            </a>
          </div>
        </nav>
      </aside>

      <main className="playground-main">
        <header className="playground-header">
          <div>
            <p className="playground-eyebrow">localhost only</p>
            <h2>{isRulesPage ? 'Harness Rules' : component.name}</h2>
          </div>
          <Link className="playground-back" href="/">Back to app</Link>
        </header>

        {isRulesPage ? (
          <HarnessRulesPage />
        ) : (
          <ComponentPage component={component} key={`${section.id}/${component.id}`} section={section} />
        )}
      </main>
    </div>
  );
}

function ComponentPage({ component, section }) {
  const [values, setValues] = useState(() => getDefaultValues(component));
  const generatedProps = component.getProps?.(values) ?? values;
  const currentProps = typeof component.getCurrentProps === 'function'
    ? component.getCurrentProps(values)
    : generatedProps;

  return (
    <section className="playground-component-page">
      <div className="playground-component-meta">
        <div>
          <p className="playground-eyebrow">{section.title}</p>
          <h3>{component.name}</h3>
          <code>{component.path}</code>
          {component.tags?.length ? (
            <div className="playground-component-tags">
              {component.tags.map((tag) => (
                <span className="playground-component-tag" key={tag}>({tag})</span>
              ))}
            </div>
          ) : null}
        </div>
        <p>{component.description}</p>
      </div>

      <div className="playground-component-layout">
        <article className="playground-stage" aria-label={`${component.name} preview`}>
          {component.render(values)}
        </article>

        <VariablesPanel
          currentProps={currentProps}
          controls={component.controls ?? []}
          onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
          values={values}
        />
      </div>
    </section>
  );
}

function VariablesPanel({ controls, currentProps, onChange, values }) {
  return (
    <aside className="playground-variables" aria-label="Component variables">
      <header>
        <p className="playground-eyebrow">controls</p>
        <h3>Variables</h3>
      </header>

      {controls.length > 0 ? (
        <div className="playground-controls">
          {controls.map((control) => (
            <label className="playground-control" key={control.id}>
              <span>{control.label}</span>
              {control.type === 'select' ? (
                <select
                  onChange={(event) => onChange(control.id, event.target.value)}
                  value={values[control.id]}
                >
                  {control.options.map((option) => (
                    <option key={getControlOptionValue(option)} value={getControlOptionValue(option)}>
                      {getControlOptionLabel(option)}
                    </option>
                  ))}
                </select>
              ) : null}
              {control.type === 'text' ? (
                <input
                  onChange={(event) => onChange(control.id, event.target.value)}
                  type="text"
                  value={values[control.id]}
                />
              ) : null}
              {control.type === 'textarea' || control.type === 'json' ? (
                <textarea
                  onChange={(event) => onChange(control.id, event.target.value)}
                  rows={control.type === 'json' ? 8 : 4}
                  spellCheck={control.type !== 'json'}
                  value={values[control.id]}
                />
              ) : null}
              {control.type === 'boolean' ? (
                <input
                  checked={Boolean(values[control.id])}
                  onChange={(event) => onChange(control.id, event.target.checked)}
                  type="checkbox"
                />
              ) : null}
            </label>
          ))}
        </div>
      ) : (
        <p className="playground-muted">No variables exposed yet.</p>
      )}

      <div className="playground-props">
        <p className="playground-eyebrow">current props</p>
        <pre>{JSON.stringify(currentProps, null, 2)}</pre>
      </div>
    </aside>
  );
}

function HarnessRulesPage() {
  return (
    <section className="playground-component-page">
      <div className="playground-component-meta">
        <div>
          <p className="playground-eyebrow">required</p>
          <h3>Harness Rules</h3>
          <code>PLAYGROUND_HARNESS.md</code>
        </div>
        <p>These rules are part of the componentization workflow.</p>
      </div>
      <article className="playground-stage">
        <ol className="playground-rules">
          {harnessRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
      </article>
    </section>
  );
}

export default Playground;
