'use client'

import * as React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, id: idProp, className, ...props }: InputProps) {
  const generatedId = React.useId()
  const id = idProp ?? (label ? generatedId : undefined)
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${className ?? ''}`}
        {...props}
      />
    </div>
  )
}
