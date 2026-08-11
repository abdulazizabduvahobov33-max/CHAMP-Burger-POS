/**
 * Minimal Web Bluetooth ambient types — just the surface drivers/webBluetoothEscPosDriver.ts
 * actually uses. TypeScript's DOM lib doesn't ship these (same situation as webusb.d.ts). Chrome/
 * Edge (desktop and Android) implement this; other browsers leave `navigator.bluetooth`
 * undefined, which isSupported() already checks for.
 */

interface BluetoothRemoteGATTCharacteristic {
  writeValue(data: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  readonly connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothDevice {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BluetoothRemoteGATTServer;
}

interface BluetoothRequestDeviceFilter {
  services?: string[];
}

interface BluetoothRequestDeviceOptions {
  filters?: BluetoothRequestDeviceFilter[];
  acceptAllDevices?: boolean;
  optionalServices?: string[];
}

interface Bluetooth {
  requestDevice(options: BluetoothRequestDeviceOptions): Promise<BluetoothDevice>;
  getDevices?(): Promise<BluetoothDevice[]>;
}

interface Navigator {
  readonly bluetooth?: Bluetooth;
}
