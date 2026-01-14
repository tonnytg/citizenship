# Skills Feature for GitHub Copilot Agent

## Overview
The "Skills" feature enables modular, reusable capabilities (skills) that can be invoked by the Copilot Agent to perform specific tasks or workflows within this codebase.

## Structure
- Each skill is a self-contained module (function or class) located in `src/skills/`.
- Skills should be named descriptively (e.g., `fetchUserData`, `generateReport`).
- Skills must export a clear interface for invocation by the agent.


## Example Skill (Vite + React + Tailwind)
```tsx
// src/skills/showWelcomeBanner.tsx
import React from 'react';

export function showWelcomeBanner(projectName: string) {
  return (
    <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 my-4" role="alert">
      <p className="font-bold">Welcome to {projectName}!</p>
      <p>This project uses Vite, React, and Tailwind CSS. Start building your skills in <code>src/skills/</code>.</p>
    </div>
  );
}
```

**Instructions for UI Skills:**
- Use React functional components for UI-related skills.
- Style components using Tailwind CSS utility classes.
- Place all skills in `src/skills/` and export via `src/skills/index.ts`.
- Keep skills stateless and composable.

## Adding a New Skill
1. Create a new file in `src/skills/` (e.g., `mySkill.ts`).
2. Export the skill as a function or class.
3. Document the skill's purpose and usage in a comment at the top.


## Registering Skills
- Export all skills in `src/skills/index.ts` for easy import.


## Usage Pattern
- Import skills from `src/skills/` in your React components or agent logic.
- Example:
  ```tsx
  import { showWelcomeBanner } from './skills';
  // ...inside a React component:
  {showWelcomeBanner('CitizenBShip')}
  ```


## Conventions
- Use TypeScript and React for all UI skills.
- Write concise JSDoc comments for each skill.
- Use Tailwind CSS for styling.
- Keep skills focused on a single responsibility.

## Example Index
```ts
// src/skills/index.ts
export * from './greetUser';
// export * from './anotherSkill';
```

## References
- See `src/skills/` for implemented skills.
- Update this document as new skills are added.
