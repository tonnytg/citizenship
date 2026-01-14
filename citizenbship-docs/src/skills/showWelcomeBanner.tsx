/**
 * Example Skill: showWelcomeBanner
 *
 * This skill demonstrates how to render a reusable React component styled with Tailwind CSS.
 *
 * Usage:
 *   import { showWelcomeBanner } from './skills/showWelcomeBanner';
 *   // In a React component:
 *   {showWelcomeBanner('Your Project Name')}
 *
 * Conventions:
 * - Use React functional components for UI skills.
 * - Style components using Tailwind utility classes.
 * - Keep skills stateless and composable.
 */
import React from 'react';

export function showWelcomeBanner(projectName: string) {
  return (
    <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 my-4" role="alert">
      <p className="font-bold">Welcome to {projectName}!</p>
      <p>This project uses Vite, React, and Tailwind CSS. Start building your skills in <code>src/skills/</code>.</p>
    </div>
  );
}
