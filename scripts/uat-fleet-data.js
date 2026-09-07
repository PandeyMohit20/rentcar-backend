'use strict';

const rows = [
  ['Maruti Suzuki', 'Swift', 'ZXi', 'petrol', 'manual', 5, [180, 1800, 10500, 36000, 200, 12, 3000]],
  ['Maruti Suzuki', 'Baleno', 'Alpha AGS', 'petrol', 'automatic', 5, [200, 2000, 12000, 40000, 220, 13, 3500]],
  ['Hyundai', 'i20', 'Asta IVT', 'petrol', 'automatic', 5, [210, 2100, 12500, 42000, 230, 13, 3500]],
  ['Hyundai', 'Creta', 'SX Diesel AT', 'diesel', 'automatic', 5, [320, 3200, 19500, 65000, 350, 18, 7000]],
  ['Hyundai', 'Venue', 'SX Turbo DCT', 'petrol', 'automatic', 5, [250, 2500, 15000, 50000, 280, 15, 5000]],
  ['Tata', 'Nexon', 'Fearless Diesel AMT', 'diesel', 'automatic', 5, [280, 2800, 17000, 56000, 300, 16, 5000]],
  ['Tata', 'Punch', 'Accomplished', 'petrol', 'manual', 5, [230, 2300, 13800, 47000, 250, 14, 4000]],
  ['Mahindra', 'XUV700', 'AX7 Diesel AT', 'diesel', 'automatic', 7, [420, 4200, 25500, 85000, 450, 22, 10000]],
  ['Mahindra', 'Scorpio N', 'Z8 Diesel AT', 'diesel', 'automatic', 7, [400, 4000, 24000, 80000, 430, 22, 10000]],
  ['Kia', 'Seltos', 'HTX Diesel AT', 'diesel', 'automatic', 5, [330, 3300, 20000, 67000, 360, 18, 7000]],
  ['Honda', 'City', 'ZX CVT', 'petrol', 'automatic', 5, [300, 3000, 18000, 60000, 330, 17, 6000]],
  ['Toyota', 'Innova Crysta', 'ZX Diesel', 'diesel', 'manual', 7, [450, 4500, 27500, 90000, 480, 23, 12000]],
  ['Toyota', 'Fortuner', '4x2 Diesel AT', 'diesel', 'automatic', 7, [650, 6500, 39000, 130000, 700, 30, 20000]],
  ['Toyota', 'Camry', 'Hybrid', 'hybrid', 'automatic', 5, [550, 5500, 33000, 110000, 600, 25, 15000]],
  ['MG', 'Hector', 'Sharp Pro CVT', 'petrol', 'automatic', 5, [380, 3800, 23000, 76000, 420, 20, 9000]],
];
const rateFields = ['hourlyPrice', 'dailyPrice', 'weeklyPrice', 'monthlyPrice', 'extraHourPrice', 'extraKmPrice', 'securityDeposit'];
module.exports = rows.map(([brand, model, variant, fuelType, transmission, seatingCapacity, rates], index) => ({
  registrationNumber: model === 'Camry' ? 'REG-3936A9796012' : `UAT-MH01-${String(index + 1).padStart(4, '0')}`,
  brand, model, variant, fuelType, transmission, seatingCapacity,
  manufacturingYear: model === 'Camry' ? 2022 : 2024,
  odometer: 12000 + index * 1700,
  status: 'available',
  rates: Object.fromEntries(rateFields.map((field, i) => [field, rates[i]])),
  features: ['Air Conditioning', 'ABS', 'Airbags', 'Bluetooth', seatingCapacity === 7 ? '7 Seater' : 'Reverse Camera'],
  views: model === 'Camry' ? ['Front', 'Side', 'Rear', 'Interior'] : ['Front'],
}));
