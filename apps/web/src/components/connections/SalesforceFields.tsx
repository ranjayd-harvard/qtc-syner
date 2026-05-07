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

export function SalesforceFields({ register, errors }: Props) {
  const [showSecret, setShowSecret] = useState(false);
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label>Login URL</Label>
        <Input
          placeholder="https://login.salesforce.com"
          {...register('credentials.loginUrl' as never)}
        />
        <p className="text-xs text-slate-500">Use <code>https://test.salesforce.com</code> for sandboxes</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Client ID</Label>
          <Input {...register('credentials.clientId' as never)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Client Secret</Label>
          <div className="relative">
            <Input type={showSecret ? 'text' : 'password'} {...register('credentials.clientSecret' as never)} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-0 h-10 w-8"
              onClick={() => setShowSecret(!showSecret)}
            >
              {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Username</Label>
        <Input type="email" {...register('credentials.username' as never)} />
      </div>
      <div className="grid gap-1.5">
        <Label>Password + Security Token</Label>
        <div className="relative">
          <Input type={showPass ? 'text' : 'password'} {...register('credentials.password' as never)} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-0 h-10 w-8"
            onClick={() => setShowPass(!showPass)}
          >
            {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="text-xs text-slate-500">Concatenate your password and security token directly: <code>MyPassword&lt;token&gt;</code></p>
      </div>
    </div>
  );
}
