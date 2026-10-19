"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ServiceDetailField } from "@/lib/services";

interface ServiceDetailFieldsProps {
  fields: ServiceDetailField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

/** Renders the catalogue-declared profile fields for a service. */
export default function ServiceDetailFields({ fields, values, onChange }: ServiceDetailFieldsProps) {
  return (
    <div className="grid gap-4 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] p-4 sm:grid-cols-2">
      {fields.map((field) => {
        const id = `service-detail-${field.key}`;
        const value = values[field.key] ?? "";
        return (
          <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : undefined}>
            <Label htmlFor={id} className="text-sm font-medium text-[var(--brand-ink)]">
              {field.label}
              {field.required ? <span className="text-[var(--brand-coral)]"> *</span> : null}
            </Label>
            {field.type === "select" ? (
              <Select value={value} onValueChange={(next) => onChange(field.key, next ?? "")}>
                <SelectTrigger id={id} className="mt-1 w-full rounded-lg border-[var(--brand-line)]">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === "textarea" ? (
              <Textarea
                id={id}
                value={value}
                onChange={(event) => onChange(field.key, event.target.value)}
                placeholder={field.placeholder}
                rows={3}
                className="mt-1 resize-none rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
              />
            ) : (
              <Input
                id={id}
                type="text"
                inputMode={field.numeric ? "numeric" : undefined}
                pattern={field.numeric ? "[0-9]*" : undefined}
                value={value}
                onChange={(event) => onChange(field.key, event.target.value)}
                placeholder={field.placeholder}
                className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
              />
            )}
            {field.hint ? (
              <p className="mt-1 text-xs text-[var(--brand-muted)]">{field.hint}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
