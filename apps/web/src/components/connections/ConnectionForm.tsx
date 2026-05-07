'use client';

import { useForm, Controller } from 'react-hook-form';
import { Cloud, Server, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SalesforceFields } from './SalesforceFields';
import { NetSuiteFields } from './NetSuiteFields';
import { RedshiftFields } from './RedshiftFields';
import { useTestConnection } from '@/hooks/useExplorer';
import type { ConnectionFormValues, ConnectionSummary } from '@/types/connection';
import { cn } from '@/lib/utils';

interface ConnectionFormProps {
  defaultValues?: Partial<ConnectionFormValues> & { id?: string };
  onSubmit: (values: ConnectionFormValues) => void;
  isPending?: boolean;
}

const typeOptions = [
  { value: 'salesforce', label: 'Salesforce', icon: Cloud, color: 'text-[#0176D3]', bg: 'bg-blue-50 border-blue-200' },
  { value: 'netsuite', label: 'NetSuite', icon: Server, color: 'text-[#009A44]', bg: 'bg-green-50 border-green-200' },
  { value: 'redshift', label: 'Redshift', icon: Database, color: 'text-[#FF9900]', bg: 'bg-orange-50 border-orange-200' },
] as const;

export function ConnectionForm({ defaultValues, onSubmit, isPending }: ConnectionFormProps) {
  const { register, handleSubmit, watch, control, formState: { errors } } = useForm<ConnectionFormValues>({
    defaultValues: defaultValues as ConnectionFormValues,
  });
  const testMutation = useTestConnection();
  const selectedType = watch('type');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-1.5">
        <Label>Connection Name</Label>
        <Input
          placeholder="e.g. Production Salesforce"
          {...register('name', { required: 'Name is required' })}
        />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div className="grid gap-2">
        <Label>Source Type</Label>
        <Controller
          name="type"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <div className="grid grid-cols-3 gap-3">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => field.onChange(opt.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-lg border-2 text-sm font-medium transition-all',
                    field.value === opt.value
                      ? `${opt.bg} border-current`
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <opt.icon className={cn('w-6 h-6', field.value === opt.value ? opt.color : 'text-slate-400')} />
                  <span className={field.value === opt.value ? opt.color : 'text-slate-600'}>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {selectedType && (
        <div className="border rounded-lg p-4 bg-slate-50">
          <h3 className="text-sm font-medium text-slate-700 mb-4">Credentials</h3>
          {selectedType === 'salesforce' && <SalesforceFields register={register} errors={errors} />}
          {selectedType === 'netsuite' && <NetSuiteFields register={register} errors={errors} />}
          {selectedType === 'redshift' && <RedshiftFields register={register} errors={errors} control={control} />}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        {defaultValues?.id && (
          <Button
            type="button"
            variant="outline"
            disabled={testMutation.isPending}
            onClick={() => testMutation.mutate(defaultValues.id!)}
            className="gap-2"
          >
            {testMutation.isPending ? 'Testing…' : 'Test Connection'}
          </Button>
        )}
        <Button type="submit" disabled={isPending} className="ml-auto">
          {isPending ? 'Saving…' : 'Save Connection'}
        </Button>
      </div>
    </form>
  );
}
