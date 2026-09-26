import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva('px-4 py-2 rounded font-medium transition-colors', {
  variants: {
    variant: {
      default: 'bg-gamdom-green text-gamdom-dark hover:bg-gamdom-greenHover',
      outline: 'border border-gamdom-textDim text-gamdom-text hover:bg-gamdom-cardHover',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => (
    <button
      className={buttonVariants({ variant, className })}
      ref={ref}
      {...props}
    />
  ),
)
Button.displayName = 'Button'

export default Button
