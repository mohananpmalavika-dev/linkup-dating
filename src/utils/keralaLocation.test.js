import {
  formatProfileLocation,
  resolveKeralaLocation
} from './keralaLocation';

describe('keralaLocation helpers', () => {
  test('normalizes Kerala city aliases into district and region metadata', () => {
    expect(
      resolveKeralaLocation({
        city: 'Cochin',
        locality: 'Fort Kochi',
        pincode: '682001'
      })
    ).toEqual({
      city: 'Kochi',
      district: 'Ernakulam',
      locality: 'Fort Kochi',
      pincode: '682001',
      keralaRegion: 'central',
      state: 'Kerala',
      country: 'India'
    });
  });

  test('formats detailed profile locations without duplicate city and district labels', () => {
    expect(
      formatProfileLocation({
        city: 'Trivandrum',
        district: 'Thiruvananthapuram',
        locality: 'Kowdiar',
        keralaRegion: 'south'
      })
    ).toBe('Kowdiar, Thiruvananthapuram');
  });
});
