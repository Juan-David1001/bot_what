// Minimal ambient declarations to allow editing before dependencies are installed

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}

declare var process: {
  env: NodeJS.ProcessEnv;
};

declare module 'express' {
  // Minimal types used in the project
  export type Request = any;
  export type Response = any;
  export type NextFunction = any;
  export type Router = any;

  function express(): any;
  namespace express {
    function Router(): Router;
    const json: any;
  }

  // make Router available as a value export
  export function Router(): Router;

  export default express;
  export { express as Express, Router as RouterType, Request, Response, NextFunction };
}

declare module 'dotenv' {
  const dotenv: {
    config: () => { parsed?: Record<string, string> };
  };
  export default dotenv;
}

declare module 'supertest' {
  function request(app: any): any;
  namespace request {}
  export default request;
}

declare module 'qrcode-terminal' {
  function generate(qr: string, opts?: { small?: boolean }): void;
  export default { generate };
}

declare module 'whatsapp-web.js' {
  export class LocalAuth {
    constructor(opts?: any);
  }

  export class Client {
    constructor(opts?: any);
    on(event: string, cb: (...args: any[]) => void): void;
    initialize(): void;
    sendMessage(id: string, content: any): Promise<any>;
    info?: any;
  }

  export default Client;
}

declare module '@google/genai' {
  export class GoogleGenAI {
    constructor(opts?: any);
    models: {
      generateContent: (params: { model: string; contents: string; [key: string]: any }) => Promise<any>;
    };
  }

  export { GoogleGenAI };
  export default GoogleGenAI;
}
