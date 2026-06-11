import { zodResolver } from "@hookform/resolvers/zod";
import { type CreateContractInput, createContractSchema } from "@quitto/shared";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
} from "react-hook-form";
import { Stepper } from "@/components/stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateContractMutation } from "@/hooks/use-contract-mutations";
import { formatBRL } from "@/lib/format";
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

function FieldError({ name }: { name: string }) {
  const { formState } = useFormContext<CreateContractInput>();
  const err = getNestedError(formState.errors, name);
  if (typeof err?.message !== "string") {
    return null;
  }
  return (
    <p className="mt-1.5 font-medium text-destructive text-xs">{err.message}</p>
  );
}

function StepBasic() {
  const { register } = useFormContext<CreateContractInput>();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label htmlFor="title">Título</Label>
        <Input
          className="mt-1.5"
          id="title"
          placeholder="Ex.: Apartamento do irmão"
          {...register("title")}
        />
        <FieldError name="title" />
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
        <select
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          id="ownerRole"
          {...register("ownerRole")}
        >
          <option value="buyer">Comprador</option>
          <option value="seller">Vendedor</option>
          <option value="neutral">Neutro</option>
        </select>
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
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label htmlFor="total">Valor total (centavos)</Label>
        <Input
          className="mt-1.5 tabular-nums"
          id="total"
          type="number"
          {...register("schedule.totalAmountCents", { valueAsNumber: true })}
        />
        <FieldError name="schedule.totalAmountCents" />
      </div>
      <div>
        <Label htmlFor="count">Nº de parcelas</Label>
        <Input
          className="mt-1.5 tabular-nums"
          id="count"
          type="number"
          {...register("schedule.installmentsCount", { valueAsNumber: true })}
        />
        <FieldError name="schedule.installmentsCount" />
      </div>
      <div>
        <Label htmlFor="first">1º vencimento</Label>
        <Input
          className="mt-1.5 tabular-nums"
          id="first"
          placeholder="AAAA-MM-DD"
          {...register("schedule.firstDueDate")}
        />
        <FieldError name="schedule.firstDueDate" />
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

function CustomSchedule() {
  const { control, register } = useFormContext<CreateContractInput>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "schedule.installments" as never,
  });
  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, index) => (
        <div
          className="flex items-end gap-2 rounded-lg border border-border bg-card p-3"
          key={field.id}
        >
          <div className="flex-1">
            <Label>Valor (centavos)</Label>
            <Input
              className="mt-1.5 tabular-nums"
              type="number"
              {...register(
                `schedule.installments.${index}.amountCents` as const,
                { valueAsNumber: true }
              )}
            />
          </div>
          <div className="flex-1">
            <Label>Vencimento</Label>
            <Input
              className="mt-1.5 tabular-nums"
              placeholder="AAAA-MM-DD"
              {...register(`schedule.installments.${index}.dueDate` as const)}
            />
          </div>
          <Button
            aria-label="Remover parcela"
            onClick={() => remove(index)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
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
  const navigate = useNavigate();
  const createMutation = useCreateContractMutation();
  const [step, setStep] = useState(0);

  const form = useForm<CreateContractInput>({
    resolver: zodResolver(createContractSchema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      ownerRole: "buyer",
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
    navigate({ to: "/contracts/$id", params: { id: created.id } });
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
    <div className="mx-auto max-w-xl p-6">
      <div className="mb-6">
        <h1 className="font-bold font-display text-2xl text-foreground tracking-tight">
          Novo contrato
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Defina os dados básicos e o cronograma de parcelas.
        </p>
      </div>

      <div className="mb-8">
        <Stepper current={step} onStepClick={setStep} steps={STEPS} />
      </div>

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
    </div>
  );
}
