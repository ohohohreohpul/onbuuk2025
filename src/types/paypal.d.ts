// Global type declarations for external SDKs

interface PayPalButtonsComponent {
  render: (container: HTMLElement | string) => Promise<void>;
}

interface PayPalButtonsOptions {
  style?: {
    layout?: 'vertical' | 'horizontal';
    color?: 'gold' | 'blue' | 'silver' | 'white' | 'black';
    shape?: 'rect' | 'pill';
    label?: 'paypal' | 'checkout' | 'buynow' | 'pay' | 'installment';
    height?: number;
  };
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string; payerID?: string }) => Promise<void>;
  onError?: (err: Error) => void;
  onCancel?: () => void;
}

interface PayPalNamespace {
  Buttons: (options: PayPalButtonsOptions) => PayPalButtonsComponent;
}

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

export {};
