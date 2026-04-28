const keralaLocations = require('../../src/data/keralaLocations.json');

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

const normalizeKeralaRegion = (value) => regionLookup.get(normalizeKey(value))?.value || '';

const normalizeKeralaDistrict = (value) =>
  districtLookup.get(normalizeKey(value))?.value || '';

const getDistrictRecord = (value) => districtByValue.get(normalizeKeralaDistrict(value)) || null;

const inferKeralaDistrictFromCity = (city) => {
  const directDistrict = districtByCity.get(normalizeKey(city));
  if (directDistrict) {
    return directDistrict.value;
  }

  return cityLookup.get(normalizeKey(city))?.district || '';
};

const normalizeMajorKeralaCity = (city) =>
  cityLookup.get(normalizeKey(city))?.value || normalizeText(city);

const inferKeralaRegionFromDistrict = (district) =>
  getDistrictRecord(district)?.region || '';

const normalizeIndianPincode = (value) => {
  const digits = String(value || '').replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  return /^\d{6}$/.test(digits) ? digits : null;
};

const resolveKeralaLocation = (location = {}) => {
  const city = normalizeMajorKeralaCity(location.city);
  const district = normalizeKeralaDistrict(location.district) || inferKeralaDistrictFromCity(city);
  const explicitKeralaRegion = normalizeKeralaRegion(location.keralaRegion || location.region);
  const inferredKeralaRegion = inferKeralaRegionFromDistrict(district);
  const keralaRegion = inferredKeralaRegion || explicitKeralaRegion;
  const pincode = normalizeIndianPincode(location.pincode);

  return {
    city,
    district,
    locality: normalizeText(location.locality),
    pincode,
    keralaRegion,
    state: district || keralaRegion ? 'Kerala' : normalizeText(location.state),
    country: district || keralaRegion ? 'India' : normalizeText(location.country)
  };
};

const buildLocationSearchTerms = (value) => {
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
  ]).map((item) => item.toLowerCase());
};

module.exports = {
  buildLocationSearchTerms,
  inferKeralaDistrictFromCity,
  inferKeralaRegionFromDistrict,
  normalizeIndianPincode,
  normalizeKeralaDistrict,
  normalizeKeralaRegion,
  normalizeMajorKeralaCity,
  resolveKeralaLocation
};
