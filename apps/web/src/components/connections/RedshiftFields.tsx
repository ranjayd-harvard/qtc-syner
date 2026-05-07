import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Controller } from 'react-hook-form';
import type { UseFormRegister, FieldErrors, Control } from 'react-hook-form';
import type { ConnectionFormValues } from '@/types/connection';

interface Props {
  register: UseFormRegister<ConnectionFormValues>;
  errors: FieldErrors<ConnectionFormValues>;
  control: Control<ConnectionFormValues>;
}

export function RedshiftFields({ register, control, errors }: Props) {
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label>Host</Label>
        <Input
          placeholder="my-cluster.abc123.us-east-1.redshift.amazonaws.com"
          {...register('credentials.host' as never)}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1.5">
          <Label>Port</Label>
          <Input
            type="number"
            placeholder="5439"
            {...register('credentials.port' as never, { valueAsNumber: true })}
          />
        </div>
        <div className="col-span-2 grid gap-1.5">
          <Label>Database</Label>
          <Input {...register('credentials.database' as never)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Username</Label>
          <Input {...register('credentials.username' as never)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Password</Label>
          <div className="relative">
            <Input
              type={showPass ? 'text' : 'password'}
              {...register('credentials.password' as never)}
            />
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
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Controller
          name={'credentials.ssl' as never}
          control={control}
          defaultValue={true as never}
          render={({ field }) => (
            <Switch
              checked={field.value as boolean}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label>Enable SSL</Label>
        <span className="text-xs text-slate-500">(Recommended for production clusters)</span>
      </div>
    </div>
  );
}
