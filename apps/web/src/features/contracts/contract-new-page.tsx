import { zodResolver } from "@hookform/resolvers/zod";
import {
  addMonths,
  CONTRACT_OWNER_ROLES,
  type CreateContractInput,
  createContractSchema,
  OWNER_ROLE,
  splitAmount,
} from "@quitto/shared";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
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
import { Money } from "@/components/money";
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
import { capitalize, formatISODateBR } from "@/lib/format";
import { PLACEHOLDER, ROLE_LABEL } from "@/lib/labels";
import { PAGE_TITLE } from "@/lib/page-title";
import { cn } from "@/lib/utils";

const STEPS = [{ label: "Básico" }, { label: "Parcelas" }];

type ScheduleMode = "auto" | "custom";
interface CustomInstallment {
  amountCents: number;
  dueDate: string;
}

/**
 * Derives the custom installments from the current auto schedule, so switching
 * Automático → Personalizado keeps the work: split amounts come over whenever a
 * total + count exist; due dates only when the 1º vencimento was filled (left
 * blank otherwise, for the user to complete). Falls back to one empty row.
 */
function autoToCustomInstallments(
  schedule: CreateContractInput["schedule"]
): CustomInstallment[] {
  if (
    schedule?.mode === "auto" &&
    schedule.totalAmountCents > 0 &&
    schedule.installmentsCount > 0
  ) {
    const firstDueDate = schedule.firstDueDate;
    return splitAmount(
      schedule.totalAmountCents,
      schedule.installmentsCount
    ).map((amountCents, i) => ({
      amountCents,
      dueDate: firstDueDate ? addMonths(firstDueDate, i) : "",
    }));
  }
  return [{ amountCents: 0, dueDate: "" }];
}

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

/** Small uppercase section label, matching the app's hero-screen grouping style. */
function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-semibold text-subtle-foreground text-xs uppercase tracking-wide",
        className
      )}
    >
      {children}
    </p>
  );
}

/** Per-step title + short helper text, shown at the top of each wizard section. */
function StepHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-semibold text-base text-foreground">{title}</h2>
      <p className="mt-0.5 text-muted-foreground text-sm">{hint}</p>
    </div>
  );
}

function StepBasic() {
  const { register, control } = useFormContext<CreateContractInput>();
  const titleAria = useErrorAria("title", "title-error");
  const ownerRoleAria = useErrorAria("ownerRole", "ownerRole-error");
  return (
    <div className="flex flex-col gap-6">
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
      </div>

      <div className="flex flex-col gap-3 border-border border-t pt-5">
        <SectionLabel>Condições</SectionLabel>
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
    </div>
  );
}

function AutoSchedule() {
  const { register } = useFormContext<CreateContractInput>();
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
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="count">Nº de parcelas</Label>
          <Input
            className="mt-1.5 tabular-nums"
            id="count"
            type="number"
            {...countAria}
            {...register("schedule.installmentsCount", {
              valueAsNumber: true,
            })}
          />
          <FieldError id="count-error" name="schedule.installmentsCount" />
        </div>
        <div>
          <Label htmlFor="first">1º vencimento</Label>
          <DateField
            id="first"
            name="schedule.firstDueDate"
            {...firstDueAria}
          />
          <FieldError id="first-error" name="schedule.firstDueDate" />
        </div>
      </div>
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
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5 shadow-[var(--shadow-sm)] transition-colors hover:border-primary/40 sm:flex-row sm:items-start">
      <span
        aria-hidden="true"
        className="mt-1 hidden size-6 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground text-xs tabular-nums sm:flex"
      >
        {index + 1}
      </span>
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
        className="self-end active:scale-[0.97] sm:mt-5 sm:self-auto"
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
          <p className="font-semibold text-foreground">
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
        className="self-start active:scale-[0.97]"
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
        "rounded-md px-4 py-1.5 font-medium text-sm transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-[0.97]",
        active
          ? "bg-primary text-primary-foreground shadow-[var(--shadow-sm)]"
          : "text-muted-foreground hover:bg-background hover:text-foreground"
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

/**
 * Reads the current schedule (either mode) into a normalized shape for the
 * receipt-like summary — same three numbers regardless of auto vs custom.
 */
function useScheduleSummary(): {
  count: number;
  totalCents: number;
  firstDueDate: string;
} {
  const { watch } = useFormContext<CreateContractInput>();
  const schedule = watch("schedule");

  if (schedule?.mode === "auto") {
    return {
      count: Number(schedule.installmentsCount) || 0,
      totalCents: Number(schedule.totalAmountCents) || 0,
      firstDueDate: schedule.firstDueDate || "",
    };
  }
  if (schedule?.mode === "custom") {
    const installments = schedule.installments ?? [];
    return {
      count: installments.length,
      totalCents: installments.reduce(
        (sum, i) => sum + (Number(i?.amountCents) || 0),
        0
      ),
      firstDueDate: installments[0]?.dueDate || "",
    };
  }
  return { count: 0, totalCents: 0, firstDueDate: "" };
}

/** Receipt-like recap of the contract about to be created — title, role, parcelas, 1ª data, valor. */
function ContractSummary() {
  const { watch } = useFormContext<CreateContractInput>();
  const title = watch("title");
  const ownerRole = watch("ownerRole");
  const { count, totalCents, firstDueDate } = useScheduleSummary();
  const hasSchedule = count > 0 && totalCents > 0;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
      <SectionLabel className="text-primary-strong">
        Resumo antes de criar
      </SectionLabel>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-muted-foreground text-xs">Título</dt>
          <dd className="mt-0.5 truncate font-medium text-foreground">
            {title || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Meu papel</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {capitalize(ROLE_LABEL[ownerRole] ?? ownerRole)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Parcelas</dt>
          <dd className="mt-0.5 font-medium text-foreground tabular-nums">
            {count > 0 ? count : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">1ª data</dt>
          <dd className="mt-0.5 font-medium text-foreground tabular-nums">
            {firstDueDate ? formatISODateBR(firstDueDate) : "—"}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between border-primary/15 border-t pt-3">
        <span className="text-muted-foreground text-sm">Valor total</span>
        {hasSchedule ? (
          <Money cents={totalCents} size="md" />
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </div>
    </div>
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
        : {
            mode: "custom",
            installments: autoToCustomInstallments(form.getValues("schedule")),
          },
      { shouldValidate: false }
    );
  }

  return (
    <PageContainer width="form">
      <header className="mb-6">
        <h1 className="font-bold text-2xl text-foreground tracking-tight">
          Novo contrato
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Defina os dados básicos e o cronograma de parcelas.
        </p>
      </header>

      <Card className="p-6 sm:p-8">
        <Stepper current={step} onStepClick={setStep} steps={STEPS} />

        <FormProvider {...form}>
          <form
            className="mt-6 border-border border-t pt-6"
            onSubmit={onSubmit}
          >
            {step === 0 ? (
              <>
                <StepHeading
                  hint="Título, papel e condições do acordo."
                  title="Dados do contrato"
                />
                <StepBasic />
                <div className="mt-8 flex justify-end border-border border-t pt-6">
                  <Button
                    className="w-full active:scale-[0.97] sm:w-auto"
                    onClick={goNext}
                    type="button"
                  >
                    Avançar
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <StepHeading
                  hint="Gere as parcelas automaticamente a partir de um valor total, ou monte cada uma manualmente."
                  title="Cronograma de parcelas"
                />
                <div className="mb-5 inline-flex gap-1 rounded-lg border border-border bg-muted/40 p-1 text-sm">
                  <ModeButton
                    active={mode === "auto"}
                    onClick={() => setMode("auto")}
                  >
                    Automático
                  </ModeButton>
                  <ModeButton
                    active={mode === "custom"}
                    onClick={() => setMode("custom")}
                  >
                    Personalizado
                  </ModeButton>
                </div>
                {mode === "auto" ? <AutoSchedule /> : <CustomSchedule />}
                <div className="mt-6">
                  <ContractSummary />
                </div>
                <div className="mt-8 flex items-center justify-between gap-3 border-border border-t pt-6">
                  <Button
                    className="active:scale-[0.97]"
                    onClick={() => setStep(0)}
                    type="button"
                    variant="secondary"
                  >
                    <ChevronLeft aria-hidden="true" className="size-4" />
                    Voltar
                  </Button>
                  <Button
                    className="active:scale-[0.97]"
                    disabled={createMutation.isPending}
                    type="submit"
                  >
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
