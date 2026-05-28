import React from "react";

interface FieldLabelProps {
  children: React.ReactNode;
  htmlFor?: string;
}

export default function FieldLabel({ children, htmlFor }: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--io-text-muted)",
        marginBottom: 3,
      }}
    >
      {children}
    </label>
  );
}
