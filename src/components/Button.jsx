import React from 'react';

export default function Button({ 
  children, 
  variant = 'primary', 
  className = '', 
  ...props 
}) {
  const baseStyles = "inline-flex items-center justify-center font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-accent hover:bg-blue-500 text-white px-4 py-2",
    secondary: "bg-panel-alt hover:bg-panel border border-border text-primary px-4 py-2",
    critical: "bg-critical hover:bg-red-600 text-white px-4 py-2",
    ghost: "bg-transparent hover:bg-panel-alt border border-transparent hover:border-border text-secondary hover:text-primary px-3 py-1.5",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
