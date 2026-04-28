// Kerala Safe Meetup Spots & Emergency Data
// Target: May 1 Kerala Launch

export const KERALA_EMERGENCY_NUMBERS = [
  { label: 'Police', number: '100', description: 'Immediate police assistance' },
  { label: 'Ambulance', number: '108', description: 'Free ambulance service' },
  { label: 'Fire', number: '101', description: 'Fire emergency' },
  { label: 'Women Helpline', number: '1091', description: 'Women safety helpline' },
  { label: 'Child Helpline', number: '1098', description: 'Child protection' },
  { label: 'Kerala Police Control', number: '0471-2331843', description: 'State control room' },
  { label: 'Crime Stopper', number: '1090', description: 'Anonymous crime reporting' },
];

export const KERALA_SAFE_SPOTS = {
  kochi: [
    { name: 'Lulu Mall', area: 'Edappally', type: 'mall', safety: 'High - CCTV, security, crowds' },
    { name: 'Marine Drive', area: 'Ernakulam', type: 'waterfront', safety: 'High - Public, well-lit, police patrol' },
    { name: 'Fort Kochi Beach', area: 'Fort Kochi', type: 'beach', safety: 'Medium-High - Tourist area, frequent patrols' },
    { name: 'Panampilly Nagar', area: 'Panampilly Nagar', type: 'cafe district', safety: 'High - Upscale area, cafes with security' },
    { name: 'LuLu International Convention Centre', area: 'Palarivattom', type: 'convention', safety: 'High - Professional security' },
    { name: 'Centre Square Mall', area: 'MG Road', type: 'mall', safety: 'High - Central location, CCTV' },
  ],
  trivandrum: [
    { name: 'Kovalam Beach', area: 'Kovalam', type: 'beach', safety: 'Medium-High - Tourist police present' },
    { name: 'Shangumugham Beach', area: 'Shangumugham', type: 'beach', safety: 'Medium-High - Local crowd, lifeguards' },
    { name: 'MG Road', area: 'Thampanoor', type: 'shopping', safety: 'High - Central, well-lit, busy' },
    { name: 'Palayam', area: 'Palayam', type: 'public square', safety: 'High - Government area, police presence' },
    { name: 'Mall of Travancore', area: 'Chacka', type: 'mall', safety: 'High - Modern mall with security' },
  ],
  kozhikode: [
    { name: 'Mananchira Square', area: 'Mananchira', type: 'park', safety: 'High - Central, well-maintained, police' },
    { name: 'SM Street', area: 'Beypore', type: 'market', safety: 'Medium-High - Busy, well-lit evenings' },
    { name: 'Kappad Beach', area: 'Kappad', type: 'beach', safety: 'Medium - Tourist spot, limited evening patrol' },
    { name: 'Focus Mall', area: 'Rajaji Road', type: 'mall', safety: 'High - Mall security, CCTV' },
  ],
  thrissur: [
    { name: 'Swaraj Round', area: 'Thekkinkadu Maidan', type: 'public', safety: 'High - Central, always busy' },
    { name: 'Vadakkunnathan Temple', area: 'Thekkinkadu', type: 'temple', safety: 'High - Religious site, security' },
    { name: 'Sobha City Mall', area: 'Puzhakkal', type: 'mall', safety: 'High - Modern security' },
  ],
  kottayam: [
    { name: 'Kumarakom', area: 'Kumarakom', type: 'backwaters', safety: 'Medium-High - Resort area, boat staff' },
    { name: 'Illikkal Kallu', area: 'Vagamon', type: 'trekking', safety: 'Medium - Daytime only, go in groups' },
    { name: 'Mall of Joy', area: 'Kottayam Town', type: 'mall', safety: 'High - Mall security' },
  ],
  alappuzha: [
    { name: 'Alleppey Beach', area: 'Alappuzha', type: 'beach', safety: 'Medium-High - Tourist area, lifeguards' },
    { name: 'Backwaters Jetty', area: 'Alappuzha', type: 'waterfront', safety: 'Medium - Public jetty, daytime best' },
  ],
};

export const KERALA_FESTIVALS = [
  { name: 'Onam', month: 'August-September', description: 'Kerala harvest festival with floral decorations and feasts' },
  { name: 'Vishu', month: 'April', description: 'Malayalam New Year with fireworks and sadya feast' },
  { name: 'Thrissur Pooram', month: 'April-May', description: 'Grand temple festival with elephant processions' },
  { name: 'Christmas', month: 'December', description: 'Major celebration across Kerala with lights and carols' },
  { name: 'Eid', month: 'Varies', description: 'Celebrated across Kerala with communal harmony' },
];

export const getSafeSpotsForCity = (city) => {
  const normalizedCity = city?.toLowerCase().trim() || '';
  for (const [key, spots] of Object.entries(KERALA_SAFE_SPOTS)) {
    if (normalizedCity.includes(key)) return spots;
  }
  return Object.values(KERALA_SAFE_SPOTS).flat();
};

export const getEmergencyNumbers = () => KERALA_EMERGENCY_NUMBERS;
