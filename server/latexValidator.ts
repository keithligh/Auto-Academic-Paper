/**
 * Robust LaTeX Validator
 * 
 * Replaces naive regex validation with a proper State Machine parser.
 * This ensures that:
 * 1. Escaped braces \{ \} are NOT counted as structure.
 * 2. Comments % are ignored (so % { doesn't break validation).
 * 3. Environments \begin{...} \end{...} are properly nested.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateLatexSyntax(latex: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // State Machine States
  let state: "NORMAL" | "ESCAPE" | "COMMENT" = "NORMAL";

  // Stack for brace matching { }
  let braceDepth = 0;

  // Stack for environment matching \begin{env} ... \end{env}
  const envStack: { name: string; line: number }[] = [];

  // Line tracking for error reporting
  let lineNumber = 1;

  // Buffer for reading environment names
  // We need to detect \begin{name} and \end{name}
  // This is a simplified parser: we scan for the exact strings "\begin{" and "\end{"
  // However, doing this char-by-char is tricky.
  // Hybrid approach: Use regex for environments, but use state machine for braces/comments.
  // Actually, let's do pure state machine for braces, and a separate pass or smart check for environments.
  // 
  // BETTER APPROACH:
  // 1. Strip comments and escaped characters to get "structural latex".
  // 2. Validate braces on the stripped version.
  // 3. Validate environments on the stripped version.

  // --- STEP 1: PRE-PROCESSING (Strip Comments & Escapes) ---
  let structuralLatex = "";
  let i = 0;

  while (i < latex.length) {
    const char = latex[i];

    if (char === '\n') {
      lineNumber++;
      state = "NORMAL"; // Reset comment state on newline
      structuralLatex += char;
      i++;
      continue;
    }

    if (state === "COMMENT") {
      // Ignore everything until newline
      i++;
      continue;
    }

    if (state === "ESCAPE") {
      // This char is escaped, ignore it for structural purposes
      // But keep it in the string if it's not a special char? 
      // Actually, for brace counting, we just ignore it.
      state = "NORMAL";
      i++;
      continue;
    }

    if (char === '\\') {
      state = "ESCAPE";
      // We don't add backslash to structural latex to avoid confusion?
      // Wait, we need backslash to detect \begin.
      structuralLatex += char;
      i++;
      continue;
    }

    if (char === '%') {
      state = "COMMENT";
      i++;
      continue;
    }

    // Normal character
    structuralLatex += char;
    i++;
  }

  // --- STEP 2: BRACE VALIDATION ---
  // Now we can safely scan 'structuralLatex' which has no comments and no escaped chars (except the backslash itself)
  // Wait, if I kept the backslash in structuralLatex, then \{ becomes \ { in structuralLatex?
  // My logic above: 
  // char='\' -> state=ESCAPE, add '\'
  // next char='{' -> state=NORMAL, ignore '{' (don't add to structuralLatex?)
  // If I don't add the escaped char, then "\begin" becomes "\begin".
  // But "\{" becomes "\".
  // This is perfect.

  // Let's refine Step 1 loop to be precise.
  structuralLatex = "";
  state = "NORMAL";
  i = 0;
  lineNumber = 1; // Reset for accurate error reporting? No, stripped string loses line mapping.
  // We'll just validate the logic first.

  while (i < latex.length) {
    const char = latex[i];

    if (char === '\n') {
      state = "NORMAL";
      structuralLatex += '\n'; // Keep newlines for crude line estimation
      i++;
      continue;
    }

    if (state === "COMMENT") {
      i++;
      continue;
    }

    if (state === "ESCAPE") {
      state = "NORMAL";
      // If the escaped char is a brace, we IGNORE it.
      // If it's a letter (like in \begin), we KEEP it.
      if (char === '{' || char === '}' || char === '%' || char === '$' || char === '&' || char === '#' || char === '_') {
        // It's a literal, not syntax. Skip adding to structuralLatex?
        // If we skip, "\{" becomes "\".
        // If we keep, "\{" becomes "\{". But then we count '{'.
        // So we MUST SKIP adding it to structuralLatex if we want to count braces simply.
      } else {
        // It's likely a command like \begin or \item. Keep it.
        structuralLatex += char;
      }
      i++;
      continue;
    }

    if (char === '\\') {
      state = "ESCAPE";
      structuralLatex += char;
      i++;
      continue;
    }

    if (char === '%') {
      state = "COMMENT";
      i++;
      continue;
    }

    structuralLatex += char;
    i++;
  }

  // Now structuralLatex contains:
  // - No comments
  // - No escaped braces (they are gone)
  // - Commands like \begin are intact (as \begin)
  // - Unescaped braces { } are intact

  // Check Braces
  let currentLine = 1;
  for (let j = 0; j < structuralLatex.length; j++) {
    const char = structuralLatex[j];
    if (char === '\n') currentLine++;

    if (char === '{') braceDepth++;
    if (char === '}') braceDepth--;

    if (braceDepth < 0) {
      errors.push(`Unmatched closing brace '}' at approx line ${currentLine}`);
      braceDepth = 0; // Reset to continue finding other errors
    }
  }

  if (braceDepth > 0) {
    errors.push(`Missing ${braceDepth} closing brace(s) '}' at end of document`);
  }

  // --- STEP 3: ENVIRONMENT VALIDATION ---
  // We look for \begin{name} and \end{name} in the structural latex.
  // Since we kept \begin and the braces for it (because they are not escaped), 
  // we can use regex on structuralLatex.

  const envRegex = /\\(begin|end)\s*\{([^}]+)\}/g;
  let match;

  while ((match = envRegex.exec(structuralLatex)) !== null) {
    const type = match[1]; // "begin" or "end"
    const name = match[2].trim();

    // Calculate line number for this match
    const linesBefore = structuralLatex.substring(0, match.index).split('\n').length;

    if (type === "begin") {
      envStack.push({ name, line: linesBefore });
    } else {
      if (envStack.length === 0) {
        errors.push(`Unexpected \\end{${name}} at line ${linesBefore} (no matching \\begin)`);
      } else {
        const lastEnv = envStack.pop()!;
        if (lastEnv.name !== name) {
          errors.push(`Environment mismatch: Expected \\end{${lastEnv.name}} (started line ${lastEnv.line}) but found \\end{${name}} at line ${linesBefore}`);
          // Put it back? No, usually we assume the inner one was forgotten or the outer one is wrong.
          // For robustness, we might try to recover, but reporting is enough.
        }
      }
    }
  }

  if (envStack.length > 0) {
    envStack.forEach(env => {
      errors.push(`Unclosed environment \\begin{${env.name}} from line ${env.line}`);
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
