'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { AppButton as Button } from '../ui-extensions/AppButton.jsx';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './Dialog.jsx';
import { Kbd } from './Kbd.jsx';
import { AppTextField as TextField } from '../ui-extensions/AppTextField.jsx';

function commandMatches(command, query) {
  if (!query) return true;

  const haystack = [
    command.label,
    command.description,
    command.group,
    ...(command.keywords ?? []),
  ].filter(Boolean).join(' ').toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export function CommandPalette({
  commands = [],
  inputLabel = '명령 검색',
  placeholder = 'Search commands...',
  title = 'Command menu',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const visibleCommands = useMemo(
    () => commands.filter((command) => commandMatches(command, query)),
    [commands, query]
  );

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function resetState() {
    setQuery('');
    setActiveIndex(0);
  }

  function changeOpen(nextOpen) {
    setOpen(nextOpen);

    if (!nextOpen) {
      resetState();
    }
  }

  function runCommand(command) {
    if (!command) return;

    command.onSelect?.();
    changeOpen(false);

    if (command.href) {
      window.location.href = command.href;
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button className="command-palette-trigger">
          빠른 이동
          <Kbd>K</Kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="command-palette-dialog" size="large">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Search pages and common console actions.</DialogDescription>
        </DialogHeader>
        <DialogBody className="command-palette-body">
          <TextField.Root>
            <TextField.Slot><Search size={16} /></TextField.Slot>
            <TextField.Input
              aria-label={inputLabel}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setActiveIndex((current) => Math.min(current + 1, visibleCommands.length - 1));
                }

                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActiveIndex((current) => Math.max(current - 1, 0));
                }

                if (event.key === 'Enter') {
                  event.preventDefault();
                  runCommand(visibleCommands[activeIndex]);
                }
              }}
              placeholder={placeholder}
              ref={inputRef}
              value={query}
            />
          </TextField.Root>

          <div className="command-list" role="listbox">
            {visibleCommands.length > 0 ? visibleCommands.map((command, index) => {
              const Icon = command.icon;
              return (
                <button
                  aria-selected={index === activeIndex}
                  className="command-item"
                  key={command.id}
                  onClick={() => runCommand(command)}
                  role="option"
                  type="button"
                >
                  {Icon ? <Icon aria-hidden="true" size={16} /> : null}
                  <span>
                    <strong>{command.label}</strong>
                    {command.description ? <small>{command.description}</small> : null}
                  </span>
                  {command.shortcut ? <Kbd>{command.shortcut}</Kbd> : null}
                </button>
              );
            }) : (
              <p className="command-empty">No commands found.</p>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
