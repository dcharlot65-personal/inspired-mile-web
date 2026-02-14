/// <reference types="astro/client" />

// Google Identity Services global
declare const google: {
  accounts: {
    id: {
      initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
      prompt(): void;
      renderButton(element: HTMLElement, config: Record<string, unknown>): void;
    };
  };
};
