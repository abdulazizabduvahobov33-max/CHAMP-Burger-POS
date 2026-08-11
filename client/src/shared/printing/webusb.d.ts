/**
 * Minimal WebUSB ambient types — just the surface drivers/webUsbEscPosDriver.ts actually uses.
 * TypeScript's DOM lib doesn't ship WebUSB types, and pulling in a full @types package for four
 * interfaces isn't worth the dependency. Chrome/Edge (desktop and Android) implement this; other
 * browsers leave `navigator.usb` undefined, which every call site here already checks for.
 */

interface USBEndpoint {
  readonly endpointNumber: number;
  readonly direction: "in" | "out";
  readonly type: "bulk" | "interrupt" | "isochronous";
}

interface USBAlternateInterface {
  readonly endpoints: USBEndpoint[];
}

interface USBInterface {
  readonly interfaceNumber: number;
  readonly alternate: USBAlternateInterface;
}

interface USBConfiguration {
  readonly interfaces: USBInterface[];
}

interface USBOutTransferResult {
  readonly status: "ok" | "stall" | "babble";
  readonly bytesWritten: number;
}

interface USBDevice {
  readonly vendorId: number;
  readonly productId: number;
  readonly productName?: string;
  readonly opened: boolean;
  readonly configuration: USBConfiguration | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: Uint8Array): Promise<USBOutTransferResult>;
}

interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
}

interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[];
}

interface USB extends EventTarget {
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
  getDevices(): Promise<USBDevice[]>;
}

interface Navigator {
  readonly usb?: USB;
}
