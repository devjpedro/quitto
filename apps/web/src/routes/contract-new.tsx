import { zodResolver } from "@hookform/resolvers/zod";
import {
  CONTRACT_OWNER_ROLES,
  type CreateContractInput,
  createContractSchema,
  OWNER_ROLE,
} from "@quitto/shared";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
} from "react-hook-form";
import { CurrencyField } from "@/components/currency-field";
import { DateField } from "@/components/date-field";
import { PageContainer } from "@/components/page-container";
import { Stepper } from "@/components/stepper";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateContractMutation } from "@/hooks/use-contract-mutations";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { capitalize, formatBRL } from "@/lib/format";
import { PLACEHOLDER, ROLE_LABEL } from "@/lib/labels";
import { PAGE_TITLE } from "@/lib/page-title";
import { cn } from "@/lib/utils";

const STEPS = [{ label: "Básico" }, { label: "Parcelas" }];

type ScheduleMode = "auto" | "custom";

function getNestedError(
  errors: unknown,
  path: string
): { message?: unknown } | undefined {
  let current: unknown = errors;
  for (const key of path.split(".")) {
    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[key];
    } else {
      return;
    }
  }
  return current as { message?: unknown } | undefined;
}

function useFieldError(name: string) {
  const { formState } = useFormContext<CreateContractInput>();
  const err = getNestedError(formState.errors, name);
  return typeof err?.message === "string" ? err.message : null;
}

function FieldError({ id, name }: { id: string; name: string }) {
  const message = useFieldError(name);
  if (message === null) {
    return null;
  }
  return (
    <p
      className="mt-1.5 font-medium text-destructive text-xs"
      id={id}
      role="alert"
    >
      {message}
    </p>
  );
}

/** Returns aria-invalid/aria-describedby for a field, only when it has an error. */
function useErrorAria(name: string, id: string) {
  const hasError = useFieldError(name) !== null;
  return {
    "aria-invalid": hasError ? true : undefined,
    "aria-describedby": hasError ? id : undefined,
  };
}

function StepBasic() {
  const { register, control } = useFormContext<CreateContractInput>();
  const titleAria = useErrorAria("title", "title-error");
  const ownerRoleAria = useErrorAria("ownerRole", "ownerRole-error");
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label htmlFor="title">Título</Label>
        <Input
          className="mt-1.5"
          id="title"
          placeholder={PLACEHOLDER.contractTitle}
          {...titleAria}
          {...register("title")}
        />
        <FieldError id="title-error" name="title" />
      </div>
      <div>
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Textarea
          className="mt-1.5"
          id="description"
          placeholder="Detalhes do acordo"
          rows={3}
          {...register("description")}
        />
      </div>
      <div>
        <Label htmlFor="ownerRole">Meu papel</Label>
        <Controller
          control={control}
          name="ownerRole"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger
                className="mt-1.5"
                id="ownerRole"
                {...ownerRoleAria}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_OWNER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {capitalize(ROLE_LABEL[r] ?? r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError id="ownerRole-error" name="ownerRole" />
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm transition-colors hover:border-primary/40">
        <input
          className="size-4 accent-primary"
          type="checkbox"
          {...register("requiresConfirmation")}
        />
        <span className="font-medium text-foreground">
          Exige confirmação da outra parte
        </span>
      </label>
    </div>
  );
}

function AutoSchedule() {
  const { register, watch } = useFormContext<CreateContractInput>();
  const total = Number(watch("schedule.totalAmountCents")) || 0;
  const count = Number(watch("schedule.installmentsCount")) || 0;
  const per = count > 0 ? Math.floor(total / count) : 0;
  const showPreview = count > 0 && total > 0;
  const totalAria = useErrorAria("schedule.totalAmountCents", "total-error");
  const countAria = useErrorAria("schedule.installmentsCount", "count-error");
  const firstDueAria = useErrorAria("schedule.firstDueDate", "first-error");
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label htmlFor="total">Valor total</Label>
        <CurrencyField
          id="total"
          name="schedule.totalAmountCents"
          {...totalAria}
        />
        <FieldError id="total-error" name="schedule.totalAmountCents" />
      </div>
      <div>
        <Label htmlFor="count">Nº de parcelas</Label>
        <Input
          className="mt-1.5 tabular-nums"
          id="count"
          type="number"
          {...countAria}
          {...register("schedule.installmentsCount", { valueAsNumber: true })}
        />
        <FieldError id="count-error" name="schedule.installmentsCount" />
      </div>
      <div>
        <Label htmlFor="first">1º vencimento</Label>
        <DateField id="first" name="schedule.firstDueDate" {...firstDueAria} />
        <FieldError id="first-error" name="schedule.firstDueDate" />
      </div>
      {showPreview ? (
        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-4">
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1 bg-primary/60"
          />
          <p className="font-display font-semibold text-foreground text-sm tabular-nums">
            {count} parcelas de ~{formatBRL(per)}
          </p>
          <p className="mt-0.5 text-muted-foreground text-xs tabular-nums">
            soma {formatBRL(total)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function InstallmentRow({
  index,
  onRemove,
}: {
  index: number;
  onRemove: () => void;
}) {
  const amountName = `schedule.installments.${index}.amountCents`;
  const dueName = `schedule.installments.${index}.dueDate`;
  const amountErrorId = `installment-${index}-amount-error`;
  const dueErrorId = `installment-${index}-dueDate-error`;
  const amountAria = useErrorAria(amountName, amountErrorId);
  const dueAria = useErrorAria(dueName, dueErrorId);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Label htmlFor={`amt-${index}`}>Valor</Label>
        <CurrencyField id={`amt-${index}`} name={amountName} {...amountAria} />
        <FieldError id={amountErrorId} name={amountName} />
      </div>
      <div className="flex-1">
        <Label htmlFor={`due-${index}`}>Vencimento</Label>
        <DateField id={`due-${index}`} name={dueName} {...dueAria} />
        <FieldError id={dueErrorId} name={dueName} />
      </div>
      <Button
        aria-label="Remover parcela"
        className="self-end sm:mt-5 sm:self-auto"
        onClick={onRemove}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function CustomSchedule() {
  const { control } = useFormContext<CreateContractInput>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "schedule.installments" as never,
  });
  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-border border-dashed bg-card/50 p-8 text-center">
          <p className="font-display font-semibold text-foreground">
            Nenhuma parcela ainda.
          </p>
          <p className="text-muted-foreground text-sm">
            Adicione a primeira parcela do cronograma.
          </p>
        </div>
      ) : (
        fields.map((field, index) => (
          <InstallmentRow
            index={index}
            key={field.id}
            onRemove={() => remove(index)}
          />
        ))
      )}
      <Button
        className="self-start"
        onClick={() => append({ amountCents: 0, dueDate: "" })}
        type="button"
        variant="outline"
      >
        <Plus className="size-4" />
        Adicionar parcela
      </Button>
    </div>
  );
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "px-4 py-1.5 font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function ContractNewPage() {
  useDocumentTitle(PAGE_TITLE.contractNew);
  const navigate = useNavigate();
  const createMutation = useCreateContractMutation();
  const [step, setStep] = useState(0);

  const form = useForm<CreateContractInput>({
    resolver: zodResolver(createContractSchema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      ownerRole: OWNER_ROLE.buyer,
      requiresConfirmation: false,
      schedule: {
        mode: "auto",
        totalAmountCents: 0,
        installmentsCount: 1,
        firstDueDate: "",
      },
    },
  });

  const [mode, setModeState] = useState<ScheduleMode>("auto");

  async function goNext() {
    const ok = await form.trigger([
      "title",
      "ownerRole",
      "requiresConfirmation",
    ]);
    if (ok) {
      setStep(1);
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const created = await createMutation.mutateAsync(values);
    navigate({
      to: "/contracts/$id",
      params: { id: created.id },
      search: { installment: undefined },
    });
  });

  function setMode(next: ScheduleMode) {
    if (next === mode) {
      return; // [B2] re-clicking the active mode must not reset
    }
    setModeState(next);
    form.setValue(
      "schedule",
      next === "auto"
        ? {
            mode: "auto",
            totalAmountCents: 0,
            installmentsCount: 1,
            firstDueDate: "",
          }
        : { mode: "custom", installments: [{ amountCents: 0, dueDate: "" }] },
      { shouldValidate: false }
    );
  }

  return (
    <PageContainer width="form">
      <div className="mb-6">
        <h1 className="font-bold font-display text-2xl text-foreground tracking-tight">
          Novo contrato
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Defina os dados básicos e o cronograma de parcelas.
        </p>
      </div>

      <Card className="p-6 sm:p-8">
        <Stepper current={step} onStepClick={setStep} steps={STEPS} />

        <FormProvider {...form}>
          <form onSubmit={onSubmit}>
            {step === 0 ? (
              <>
                <StepBasic />
                <div className="mt-8 flex justify-end">
                  <Button onClick={goNext} type="button">
                    Avançar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-5 inline-flex overflow-hidden rounded-lg border border-border text-sm">
                  <ModeButton
                    active={mode === "auto"}
                    onClick={() => setMode("auto")}
                  >
                    Automático
                  </ModeButton>
                  <span aria-hidden="true" className="w-px bg-border" />
                  <ModeButton
                    active={mode === "custom"}
                    onClick={() => setMode("custom")}
                  >
                    Personalizado
                  </ModeButton>
                </div>
                {mode === "auto" ? <AutoSchedule /> : <CustomSchedule />}
                <div className="mt-8 flex justify-between">
                  <Button
                    onClick={() => setStep(0)}
                    type="button"
                    variant="outline"
                  >
                    Voltar
                  </Button>
                  <Button disabled={createMutation.isPending} type="submit">
                    Criar contrato
                  </Button>
                </div>
              </>
            )}
          </form>
        </FormProvider>
      </Card>
    </PageContainer>
  );
}
