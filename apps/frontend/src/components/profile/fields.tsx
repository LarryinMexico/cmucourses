import React, { useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/20/solid";
import { ChevronUpDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { activeItems, TaxonomyItem } from "@cmucourses/profile";
import { classNames } from "~/app/utils";

// Markup and classes below mirror LevelFilter / DepartmentFilter / Aggregate so the profile
// page looks like the rest of the site.

export const INPUT_CLASS =
  "min-w-0 rounded border px-2 py-1 text-sm bg-transparent border-gray-200";
export const PRIMARY_BUTTON_CLASS =
  "inline-flex justify-center rounded border px-4 py-2 text-sm font-medium border-transparent text-blue-900 bg-blue-50 hover:bg-blue-100 disabled:cursor-default disabled:opacity-50";
export const SECONDARY_BUTTON_CLASS =
  "rounded border px-4 py-2 text-sm text-gray-500 hover:bg-gray-50";

const BUTTON_CLASS =
  "relative w-full cursor-default rounded border py-1 pl-1 pr-10 text-left transition duration-150 ease-in-out border-gray-200 sm:text-sm sm:leading-5";
const OPTIONS_CLASS =
  "shadow-xs relative z-50 max-h-60 overflow-auto rounded py-1 text-base leading-6 bg-white focus:outline-none sm:text-sm sm:leading-5";
const OPTION_CLASS =
  "relative cursor-pointer select-none py-2 pl-3 pr-9 focus:outline-none";

const Chevron = () => (
  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
    <ChevronUpDownIcon className="h-5 w-5 stroke-gray-500 " />
  </span>
);

const OptionContent = ({
  selected,
  children,
}: {
  selected: boolean;
  children: React.ReactNode;
}) => (
  <>
    <span
      className={classNames(
        "block truncate text-gray-700",
        selected ? "font-semibold" : "font-normal"
      )}
    >
      {children}
    </span>
    {selected && (
      <span className="absolute inset-y-0 right-0 flex items-center pr-4">
        <CheckIcon className="h-5 w-5" />
      </span>
    )}
  </>
);

export const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="relative text-gray-500 text-sm">
    <div>{label}</div>
    {children}
  </div>
);

// The remove button sits inside the combobox button, whose pointerdown/keydown handlers toggle the
// dropdown (and cancel the default action). Stop those events here so a press on the "x" only
// removes the pill.
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export const Pill = ({
  label,
  onRemove,
}: {
  label: string;
  onRemove?: () => void;
}) => (
  <span className="flex items-center gap-1 rounded px-2 py-0.5 text-blue-800 bg-blue-50">
    <span>{label}</span>
    {onRemove && (
      <button
        type="button"
        aria-label={`Remove ${label}`}
        title="Remove"
        className="-mr-1 rounded p-0.5 hover:bg-blue-100"
        onPointerDown={stop}
        onMouseDown={stop}
        onKeyDown={stop}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRemove();
        }}
      >
        <XMarkIcon className="h-3 w-3" />
      </button>
    )}
  </span>
);

export interface SelectOption<T> {
  value: T;
  label: string;
}

/** Single-select dropdown, styled like LevelFilter. */
export function Select<T extends string | number | null>({
  value,
  options,
  onChange,
  placeholder = "None",
  className,
  inline = false,
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  /** Sits on a row with other inputs instead of under a label. */
  inline?: boolean;
}) {
  const current = options.find((option) => option.value === value);
  // A null value is "not set": show the placeholder even if a "None" option exists.
  const display =
    current && current.value !== null ? current.label : placeholder;
  return (
    <div className={classNames("relative text-gray-500 text-sm", className)}>
      <Listbox value={value} onChange={onChange}>
        <ListboxButton
          className={classNames(BUTTON_CLASS, inline ? undefined : "mt-2")}
        >
          <span className="block truncate p-0.5">{display}</span>
          <Chevron />
        </ListboxButton>
        <div className="absolute mt-1 w-full min-w-max rounded shadow-lg bg-white">
          <ListboxOptions className={OPTIONS_CLASS}>
            {options.map((option) => (
              <ListboxOption
                key={String(option.value)}
                value={option.value}
                className={OPTION_CLASS}
              >
                {({ selected }) => (
                  <OptionContent selected={selected}>
                    {option.label}
                  </OptionContent>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      </Listbox>
    </div>
  );
}

/** Multi-select over a taxonomy with removable pills, styled like DepartmentFilter. */
export const TaxonomyMultiSelect = ({
  items,
  value,
  onChange,
  max,
}: {
  items: readonly TaxonomyItem[];
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
}) => {
  const [query, setQuery] = useState("");
  const full = max !== undefined && value.length >= max;
  const searchTerm = query.toLowerCase();
  // Deprecated entries stay visible when already chosen, but can't be newly picked.
  const options = activeItems(items).filter((item) =>
    item.label.toLowerCase().includes(searchTerm)
  );
  const labelOf = (id: string) =>
    items.find((item) => item.id === id)?.label ?? id;

  return (
    <div className="relative text-gray-500 text-sm">
      <Combobox
        value={value}
        onChange={(next: string[]) => {
          if (max !== undefined && next.length > max) return;
          onChange(next);
          setQuery("");
        }}
        multiple
      >
        <ComboboxButton as="div" className={classNames(BUTTON_CLASS, "mt-2")}>
          <span className="flex flex-wrap gap-1">
            {value.length === 0 && query.length === 0 && (
              <span className="p-0.5">None</span>
            )}
            {value.map((id) => (
              <Pill
                key={id}
                label={labelOf(id)}
                onRemove={() => onChange(value.filter((other) => other !== id))}
              />
            ))}
            <ComboboxInput
              className="shadow-xs flex rounded py-0.5 text-base leading-6 bg-white focus:outline-none sm:text-sm sm:leading-5"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (
                  e.key === "Backspace" &&
                  query.length === 0 &&
                  value.length > 0
                ) {
                  onChange(value.slice(0, -1));
                }
              }}
            />
          </span>
          <Chevron />
        </ComboboxButton>
        <div className="absolute mt-1 w-full rounded shadow-lg bg-white">
          <ComboboxOptions className={OPTIONS_CLASS}>
            {options.map((item) => (
              <ComboboxOption
                key={item.id}
                value={item.id}
                disabled={full && !value.includes(item.id)}
                className={({ disabled }) =>
                  classNames(OPTION_CLASS, disabled ? "opacity-50" : undefined)
                }
              >
                {({ selected }) => (
                  <OptionContent selected={selected}>
                    {item.label}
                  </OptionContent>
                )}
              </ComboboxOption>
            ))}
          </ComboboxOptions>
        </div>
      </Combobox>
      {max !== undefined && (
        <div className="mt-1 text-gray-400">Up to {max}</div>
      )}
    </div>
  );
};

/** Number input that allows being temporarily blank, which means "not set". */
export const OptionalNumberInput = ({
  value,
  onChange,
  min,
  max,
  className,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  className?: string;
}) => (
  <input
    type="number"
    inputMode="numeric"
    min={min}
    max={max}
    value={value ?? ""}
    onChange={(e) => {
      if (e.target.value === "") return onChange(null);
      const parsed = parseInt(e.target.value);
      if (!Number.isNaN(parsed)) onChange(parsed);
    }}
    className={classNames(INPUT_CLASS, "w-24", className)}
  />
);
