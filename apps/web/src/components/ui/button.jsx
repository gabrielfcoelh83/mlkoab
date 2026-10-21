import * as React from "react"
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

// O `button` do shadcn, ajustado ao "Papel e tinta". Três desvios do original,
// todos por causa do app:
// - ele entra sem o preflight do Tailwind, então o botão nativo (fundo cinza,
//   borda 2px) precisa ser neutralizado no base — daí `appearance-none`,
//   `bg-transparent` e a borda transparente de 1px fixa;
// - as cores vêm dos tokens do shadcn que o tema já troca (`--primary`,
//   `--primary-dark`, `--border`), então o botão segue a paleta escolhida;
// - os tamanhos são os da tela (42px de altura, raio 7, texto 13,5), não os do
//   tema padrão — `lg` é o botão de ação e `sm` o de controle pequeno.
// O "toque" do Animate UI virou `motion-safe:active:scale`, que é CSS: sai
// sozinho em quem pediu movimento reduzido.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer appearance-none items-center justify-center gap-2 rounded-[7px] border border-transparent bg-transparent font-[inherit] text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 motion-safe:active:scale-[0.985] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-primary-dark bg-primary text-primary-foreground hover:bg-primary/92",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-[6px] px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-[42px] gap-2 px-[18px] text-[13.5px] has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-[6px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
