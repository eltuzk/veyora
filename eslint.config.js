import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "tools/**"] },
  ...tseslint.configs.recommended,
  {
    // Rule 3 of docs/SPEC.md: the scheduler package must stay pure.
    files: ["packages/scheduler/src/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: "scheduler is pure: pass `now` in as a parameter." },
        { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: "scheduler is pure: pass `now` in as a parameter." },
        { selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']", message: "scheduler is pure: pass a fuzz seed in as a parameter." }
      ],
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "ts-fsrs", message: "Import FSRS6Algorithm from 'ts-fsrs/models/fsrs-6' only (no DefaultScheduler / FSRS-7)." }] }
      ]
    }
  }
);
