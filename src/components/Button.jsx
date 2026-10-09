import React from 'react';

export default function Button({ 
  children, 
  variant = 'primary', 
  className = '', 
  ...props 
}) {
  const baseStyles = "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";
  
  const variants = {
    primary: "bg-accent px-4 py-2.5 text-white hover:bg-blue-500",
    secondary: "border border-border bg-panel-alt px-4 py-2.5 text-primary hover:border-muted hover:bg-panel",
    danger: "bg-critical px-4 py-2.5 text-white hover:bg-red-600",
    critical: "bg-critical px-4 py-2.5 text-white hover:bg-red-600",
    ghost: "border border-transparent bg-transparent px-3 py-2 text-secondary hover:border-border hover:bg-panel-alt hover:text-primary",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
