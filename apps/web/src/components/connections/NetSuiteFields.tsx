import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import type { ConnectionFormValues } from '@/types/connection';

interface Props {
  register: UseFormRegister<ConnectionFormValues>;
  errors: FieldErrors<ConnectionFormValues>;
}

export function NetSuiteFields({ register, errors }: Props) {
  const [show, setShow] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setShow((s) => ({ ...s, [key]: !s[key] }));

  const SecretInput = ({ field, label }: { field: string; label: string }) => (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type={show[field] ? 'text' : 'password'}
          {...register(`credentials.${field}` as never)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-0 h-10 w-8"
          onClick={() => toggle(field)}
        >
          {show[field] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label>Account ID</Label>
        <Input placeholder="1234567" {...register('credentials.accountId' as never)} />
        <p className="text-xs text-slate-500">Your NetSuite account ID (numeric, found in Setup &gt; Company &gt; Company Information)</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SecretInput field="consumerKey" label="Consumer Key" />
        <SecretInput field="consumerSecret" label="Consumer Secret" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SecretInput field="tokenId" label="Token ID" />
        <SecretInput field="tokenSecret" label="Token Secret" />
      </div>
      <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-md border">
        Uses Token-Based Authentication (TBA). Generate tokens in NetSuite: Setup &gt; Integration &gt; Manage Access Tokens.
      </p>
    </div>
  );
}
