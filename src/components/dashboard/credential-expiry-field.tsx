'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface CredentialExpiryFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
  id?: string;
  label?: string;
  helpText?: string;
  disabled?: boolean;
}

export function CredentialExpiryField({
  value,
  onChange,
  id = 'credential-expiry',
  label = 'Expires on',
  helpText = 'Optional. Credential is flagged as degraded when the date is within 7 days.',
  disabled = false,
}: CredentialExpiryFieldProps) {
  const hasExpiry = value !== null && value !== '';
  const dateInputValue = hasExpiry ? (value as string).slice(0, 10) : '';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${id}-enabled`}
          checked={hasExpiry}
          onCheckedChange={(checked) => {
            if (!checked) {
              onChange(null);
            } else {
              const ninetyDaysOut = new Date();
              ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90);
              onChange(ninetyDaysOut.toISOString().slice(0, 10));
            }
          }}
          disabled={disabled}
        />
        <Label htmlFor={`${id}-enabled`} className="cursor-pointer">
          {label}
        </Label>
      </div>
      {hasExpiry && (
        <>
          <Input
            id={id}
            type="date"
            value={dateInputValue}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
            min={new Date().toISOString().slice(0, 10)}
          />
          {helpText && (
            <p className="text-xs text-muted-foreground">{helpText}</p>
          )}
        </>
      )}
    </div>
  );
}
