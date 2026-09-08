/**
 * +html — coquille des écrans (web uniquement).
 * L'app mobile doit se présenter comme un TÉLÉPHONE même quand on la
 * regarde sur un grand écran : colonne de 430 px max, centrée, posée sur
 * un fond de bureau plus sombre. Le contenu reste fluide en dessous.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

const FRAME_CSS = `
  html, body {
    background: #C9C6BF !important; /* bureau derrière le téléphone */
    overscroll-behavior: none;
  }
  #root {
    max-width: 430px;
    margin: 0 auto;
    min-height: 100vh;
    background: #E4E2DC;
  }
  @media (min-width: 480px) {
    #root {
      border-left: 1px solid #D8D4CB;
      border-right: 1px solid #D8D4CB;
      box-shadow: 0 0 0 1px rgba(16,17,20,0.06);
    }
  }
`;

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: FRAME_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}