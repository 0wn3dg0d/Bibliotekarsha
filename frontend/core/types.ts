export interface BibliotekarshaModule {
  id: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  mountGlobal?: () => () => void;
  mountDocument?: (doc: Document) => () => void;
}

export interface GamePageWidget {
  id: string;
  order: number;
  render: (appId: number) => any;
}

export interface NfoSection {
  id: string;
  title: string;
  subtitle?: string;
  order: number;
  render: (appId: number) => any;
}
