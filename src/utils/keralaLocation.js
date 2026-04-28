import keralaLocations from '../data/keralaLocations.json';

const normalizeText = (value) => String(value || '').trim();
const normalizeKey = (value) => normalizeText(value).toLowerCase();

const unique = (items) => {
  const seen = new Set();

  return items.filter((item) => {
    const key = normalizeKey(item);
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const regionLookup = new Map();
const districtLookup = new Map();
const districtByValue = new Map();
const districtByCity = new Map();
const cityLookup = new Map();

keralaLocations.regions.forEach((region) => {
  [region.value, region.label].forEach((token) => {
    regionLookup.set(normalizeKey(token), region);
  });
});

keralaLocations.districts.forEach((district) => {
  districtByValue.set(district.value, district);

  [district.value, district.label, ...(district.aliases || [])].forEach((token) => {
    districtLookup.set(normalizeKey(token), district);
  });

  (district.cityAliases || []).forEach((cityAlias) => {
    districtByCity.set(normalizeKey(cityAlias), district);
  });
});

keralaLocations.majorCities.forEach((city) => {
  [city.value, ...(city.aliases || [])].forEach((token) => {
    cityLookup.set(normalizeKey(token), city);
  });
});

export const KERALA_REGION_OPTIONS = keralaLocations.regions;
export const KERALA_DISTRICT_OPTIONS = keralaLocations.districts.map((district) => ({
  value: district.value,
  label: district.label,
  region: district.region
}));

export const normalizeKeralaRegion = (value) => regionLookup.get(normalizeKey(value))?.value || '';

export const getKeralaRegionLabel = (value) =>
  regionLookup.get(normalizeKey(value))?.label || normalizeText(value);

export const normalizeKeralaDistrict = (value) =>
  districtLookup.get(normalizeKey(value))?.value || '';

export const getDistrictRecord = (value) => districtByValue.get(normalizeKeralaDistrict(value)) || null;

export const inferKeralaDistrictFromCity = (city) => {
  const directDistrict = districtByCity.get(normalizeKey(city));
  if (directDistrict) {
    return directDistrict.value;
  }

  return cityLookup.get(normalizeKey(city))?.district || '';
};

export const normalizeMajorKeralaCity = (city) =>
  cityLookup.get(normalizeKey(city))?.value || normalizeText(city);

export const inferKeralaRegionFromDistrict = (district) =>
  getDistrictRecord(district)?.region || '';

export const normalizePincodeInput = (value) =>
  String(value || '')
    .replace(/\D/g, '')
    .slice(0, 6);

export const resolveKeralaLocation = (location = {}) => {
  const city = normalizeMajorKeralaCity(location.city);
  const district = normalizeKeralaDistrict(location.district) || inferKeralaDistrictFromCity(city);
  const explicitKeralaRegion = normalizeKeralaRegion(location.keralaRegion || location.region);
  const inferredKeralaRegion = inferKeralaRegionFromDistrict(district);
  const keralaRegion = inferredKeralaRegion || explicitKeralaRegion;

  return {
    city,
    district,
    locality: normalizeText(location.locality),
    pincode: normalizePincodeInput(location.pincode),
    keralaRegion,
    state: district || keralaRegion ? 'Kerala' : normalizeText(location.state),
    country: district || keralaRegion ? 'India' : normalizeText(location.country)
  };
};

export const getDistrictOptionsForRegion = (region) => {
  const normalizedRegion = normalizeKeralaRegion(region);

  return !normalizedRegion
    ? KERALA_DISTRICT_OPTIONS
    : KERALA_DISTRICT_OPTIONS.filter((district) => district.region === normalizedRegion);
};

export const buildLocationSearchTerms = (value) => {
  const normalizedValue = normalizeText(value);
  const key = normalizeKey(normalizedValue);
  const district = districtLookup.get(key) || districtByCity.get(key);
  const city = cityLookup.get(key);

  return unique([
    normalizedValue,
    city?.value,
    ...(city?.aliases || []),
    city?.district,
    district?.value,
    ...(district?.aliases || []),
    ...(district?.cityAliases || [])
  ]);
};

export const formatProfileLocation = (location = {}, options = {}) => {
  const resolvedLocation = resolveKeralaLocation(location);
  const parts = unique([
    resolvedLocation.locality,
    resolvedLocation.city,
    resolvedLocation.district,
    options.includeRegion ? getKeralaRegionLabel(resolvedLocation.keralaRegion) : ''
  ]);

  return parts.join(', ');
};
