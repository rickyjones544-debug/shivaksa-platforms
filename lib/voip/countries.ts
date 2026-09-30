/**
 * Minimal E.164 country-calling-code map for the multi-carrier platform.
 *
 * This is intentionally a lightweight, self-contained file. It supports the
 * supplied Teloz test destinations and major worldwide destinations without
 * adding a heavy dependency. If more precise numbering-plan detection becomes
 * necessary in the future, this module can be replaced with libphonenumber-js.
 */

export interface CountryInfo {
  /** E.164 country calling code without leading '+', e.g. "30" */
  code: string;
  /** ISO-3166-1 alpha-2 code, e.g. "GR" */
  iso: string;
  /** Human-readable name */
  name: string;
}

/**
 * Country calling codes sorted longest-first so that multi-digit codes are
 * matched before their prefixes (e.g. 420 before 42).
 */
export const E164_COUNTRY_CODES: CountryInfo[] = [
  { code: '998', iso: 'UZ', name: 'Uzbekistan' },
  { code: '996', iso: 'KG', name: 'Kyrgyzstan' },
  { code: '995', iso: 'GE', name: 'Georgia' },
  { code: '994', iso: 'AZ', name: 'Azerbaijan' },
  { code: '993', iso: 'TM', name: 'Turkmenistan' },
  { code: '992', iso: 'TJ', name: 'Tajikistan' },
  { code: '977', iso: 'NP', name: 'Nepal' },
  { code: '976', iso: 'MN', name: 'Mongolia' },
  { code: '975', iso: 'BT', name: 'Bhutan' },
  { code: '974', iso: 'QA', name: 'Qatar' },
  { code: '973', iso: 'BH', name: 'Bahrain' },
  { code: '972', iso: 'IL', name: 'Israel' },
  { code: '971', iso: 'AE', name: 'United Arab Emirates' },
  { code: '970', iso: 'PS', name: 'Palestine' },
  { code: '968', iso: 'OM', name: 'Oman' },
  { code: '967', iso: 'YE', name: 'Yemen' },
  { code: '966', iso: 'SA', name: 'Saudi Arabia' },
  { code: '965', iso: 'KW', name: 'Kuwait' },
  { code: '964', iso: 'IQ', name: 'Iraq' },
  { code: '963', iso: 'SY', name: 'Syria' },
  { code: '962', iso: 'JO', name: 'Jordan' },
  { code: '961', iso: 'LB', name: 'Lebanon' },
  { code: '960', iso: 'MV', name: 'Maldives' },
  { code: '886', iso: 'TW', name: 'Taiwan' },
  { code: '880', iso: 'BD', name: 'Bangladesh' },
  { code: '856', iso: 'LA', name: 'Laos' },
  { code: '855', iso: 'KH', name: 'Cambodia' },
  { code: '853', iso: 'MO', name: 'Macau' },
  { code: '852', iso: 'HK', name: 'Hong Kong' },
  { code: '850', iso: 'KP', name: 'North Korea' },
  { code: '692', iso: 'MH', name: 'Marshall Islands' },
  { code: '691', iso: 'FM', name: 'Micronesia' },
  { code: '690', iso: 'TK', name: 'Tokelau' },
  { code: '689', iso: 'PF', name: 'French Polynesia' },
  { code: '688', iso: 'TV', name: 'Tuvalu' },
  { code: '687', iso: 'NC', name: 'New Caledonia' },
  { code: '686', iso: 'KI', name: 'Kiribati' },
  { code: '685', iso: 'WS', name: 'Samoa' },
  { code: '684', iso: 'AS', name: 'American Samoa' },
  { code: '683', iso: 'NU', name: 'Niue' },
  { code: '682', iso: 'CK', name: 'Cook Islands' },
  { code: '681', iso: 'WF', name: 'Wallis and Futuna' },
  { code: '680', iso: 'PW', name: 'Palau' },
  { code: '679', iso: 'FJ', name: 'Fiji' },
  { code: '678', iso: 'VU', name: 'Vanuatu' },
  { code: '677', iso: 'SB', name: 'Solomon Islands' },
  { code: '676', iso: 'TO', name: 'Tonga' },
  { code: '675', iso: 'PG', name: 'Papua New Guinea' },
  { code: '674', iso: 'NR', name: 'Nauru' },
  { code: '673', iso: 'BN', name: 'Brunei' },
  { code: '672', iso: 'AQ', name: 'Antarctica / External Territories' },
  { code: '670', iso: 'TL', name: 'Timor-Leste' },
  { code: '599', iso: 'BQ', name: 'Caribbean Netherlands' },
  { code: '598', iso: 'UY', name: 'Uruguay' },
  { code: '597', iso: 'SR', name: 'Suriname' },
  { code: '596', iso: 'MQ', name: 'Martinique' },
  { code: '595', iso: 'PY', name: 'Paraguay' },
  { code: '594', iso: 'GF', name: 'French Guiana' },
  { code: '593', iso: 'EC', name: 'Ecuador' },
  { code: '592', iso: 'GY', name: 'Guyana' },
  { code: '591', iso: 'BO', name: 'Bolivia' },
  { code: '590', iso: 'GP', name: 'Guadeloupe' },
  { code: '509', iso: 'HT', name: 'Haiti' },
  { code: '508', iso: 'PM', name: 'Saint Pierre and Miquelon' },
  { code: '507', iso: 'PA', name: 'Panama' },
  { code: '506', iso: 'CR', name: 'Costa Rica' },
  { code: '505', iso: 'NI', name: 'Nicaragua' },
  { code: '504', iso: 'HN', name: 'Honduras' },
  { code: '503', iso: 'SV', name: 'El Salvador' },
  { code: '502', iso: 'GT', name: 'Guatemala' },
  { code: '501', iso: 'BZ', name: 'Belize' },
  { code: '500', iso: 'FK', name: 'Falkland Islands' },
  { code: '423', iso: 'LI', name: 'Liechtenstein' },
  { code: '421', iso: 'SK', name: 'Slovakia' },
  { code: '420', iso: 'CZ', name: 'Czech Republic' },
  { code: '389', iso: 'MK', name: 'North Macedonia' },
  { code: '387', iso: 'BA', name: 'Bosnia and Herzegovina' },
  { code: '386', iso: 'SI', name: 'Slovenia' },
  { code: '385', iso: 'HR', name: 'Croatia' },
  { code: '383', iso: 'XK', name: 'Kosovo' },
  { code: '382', iso: 'ME', name: 'Montenegro' },
  { code: '381', iso: 'RS', name: 'Serbia' },
  { code: '380', iso: 'UA', name: 'Ukraine' },
  { code: '378', iso: 'SM', name: 'San Marino' },
  { code: '377', iso: 'MC', name: 'Monaco' },
  { code: '376', iso: 'AD', name: 'Andorra' },
  { code: '375', iso: 'BY', name: 'Belarus' },
  { code: '374', iso: 'AM', name: 'Armenia' },
  { code: '373', iso: 'MD', name: 'Moldova' },
  { code: '372', iso: 'EE', name: 'Estonia' },
  { code: '371', iso: 'LV', name: 'Latvia' },
  { code: '370', iso: 'LT', name: 'Lithuania' },
  { code: '359', iso: 'BG', name: 'Bulgaria' },
  { code: '358', iso: 'FI', name: 'Finland' },
  { code: '357', iso: 'CY', name: 'Cyprus' },
  { code: '356', iso: 'MT', name: 'Malta' },
  { code: '355', iso: 'AL', name: 'Albania' },
  { code: '354', iso: 'IS', name: 'Iceland' },
  { code: '353', iso: 'IE', name: 'Ireland' },
  { code: '352', iso: 'LU', name: 'Luxembourg' },
  { code: '351', iso: 'PT', name: 'Portugal' },
  { code: '350', iso: 'GI', name: 'Gibraltar' },
  { code: '299', iso: 'GL', name: 'Greenland' },
  { code: '298', iso: 'FO', name: 'Faroe Islands' },
  { code: '297', iso: 'AW', name: 'Aruba' },
  { code: '291', iso: 'ER', name: 'Eritrea' },
  { code: '290', iso: 'SH', name: 'Saint Helena' },
  { code: '269', iso: 'KM', name: 'Comoros' },
  { code: '268', iso: 'SZ', name: 'Eswatini' },
  { code: '267', iso: 'BW', name: 'Botswana' },
  { code: '266', iso: 'LS', name: 'Lesotho' },
  { code: '265', iso: 'MW', name: 'Malawi' },
  { code: '264', iso: 'NA', name: 'Namibia' },
  { code: '263', iso: 'ZW', name: 'Zimbabwe' },
  { code: '262', iso: 'RE', name: 'Reunion' },
  { code: '261', iso: 'MG', name: 'Madagascar' },
  { code: '260', iso: 'ZM', name: 'Zambia' },
  { code: '258', iso: 'MZ', name: 'Mozambique' },
  { code: '257', iso: 'BI', name: 'Burundi' },
  { code: '256', iso: 'UG', name: 'Uganda' },
  { code: '255', iso: 'TZ', name: 'Tanzania' },
  { code: '254', iso: 'KE', name: 'Kenya' },
  { code: '253', iso: 'DJ', name: 'Djibouti' },
  { code: '252', iso: 'SO', name: 'Somalia' },
  { code: '251', iso: 'ET', name: 'Ethiopia' },
  { code: '250', iso: 'RW', name: 'Rwanda' },
  { code: '249', iso: 'SD', name: 'Sudan' },
  { code: '248', iso: 'SC', name: 'Seychelles' },
  { code: '247', iso: 'AC', name: 'Ascension' },
  { code: '246', iso: 'IO', name: 'Diego Garcia' },
  { code: '245', iso: 'GW', name: 'Guinea-Bissau' },
  { code: '244', iso: 'AO', name: 'Angola' },
  { code: '243', iso: 'CD', name: 'DR Congo' },
  { code: '242', iso: 'CG', name: 'Congo' },
  { code: '241', iso: 'GA', name: 'Gabon' },
  { code: '240', iso: 'GQ', name: 'Equatorial Guinea' },
  { code: '239', iso: 'ST', name: 'Sao Tome and Principe' },
  { code: '238', iso: 'CV', name: 'Cape Verde' },
  { code: '237', iso: 'CM', name: 'Cameroon' },
  { code: '236', iso: 'CF', name: 'Central African Republic' },
  { code: '235', iso: 'TD', name: 'Chad' },
  { code: '234', iso: 'NG', name: 'Nigeria' },
  { code: '233', iso: 'GH', name: 'Ghana' },
  { code: '232', iso: 'SL', name: 'Sierra Leone' },
  { code: '231', iso: 'LR', name: 'Liberia' },
  { code: '230', iso: 'MU', name: 'Mauritius' },
  { code: '229', iso: 'BJ', name: 'Benin' },
  { code: '228', iso: 'TG', name: 'Togo' },
  { code: '227', iso: 'NE', name: 'Niger' },
  { code: '226', iso: 'BF', name: 'Burkina Faso' },
  { code: '225', iso: 'CI', name: 'Ivory Coast' },
  { code: '224', iso: 'GN', name: 'Guinea' },
  { code: '223', iso: 'ML', name: 'Mali' },
  { code: '222', iso: 'MR', name: 'Mauritania' },
  { code: '221', iso: 'SN', name: 'Senegal' },
  { code: '220', iso: 'GM', name: 'Gambia' },
  { code: '218', iso: 'LY', name: 'Libya' },
  { code: '216', iso: 'TN', name: 'Tunisia' },
  { code: '213', iso: 'DZ', name: 'Algeria' },
  { code: '212', iso: 'MA', name: 'Morocco' },
  { code: '98', iso: 'IR', name: 'Iran' },
  { code: '95', iso: 'MM', name: 'Myanmar' },
  { code: '94', iso: 'LK', name: 'Sri Lanka' },
  { code: '93', iso: 'AF', name: 'Afghanistan' },
  { code: '92', iso: 'PK', name: 'Pakistan' },
  { code: '91', iso: 'IN', name: 'India' },
  { code: '90', iso: 'TR', name: 'Turkey' },
  { code: '86', iso: 'CN', name: 'China' },
  { code: '84', iso: 'VN', name: 'Vietnam' },
  { code: '82', iso: 'KR', name: 'South Korea' },
  { code: '81', iso: 'JP', name: 'Japan' },
  { code: '66', iso: 'TH', name: 'Thailand' },
  { code: '65', iso: 'SG', name: 'Singapore' },
  { code: '64', iso: 'NZ', name: 'New Zealand' },
  { code: '63', iso: 'PH', name: 'Philippines' },
  { code: '62', iso: 'ID', name: 'Indonesia' },
  { code: '61', iso: 'AU', name: 'Australia' },
  { code: '60', iso: 'MY', name: 'Malaysia' },
  { code: '58', iso: 'VE', name: 'Venezuela' },
  { code: '57', iso: 'CO', name: 'Colombia' },
  { code: '56', iso: 'CL', name: 'Chile' },
  { code: '55', iso: 'BR', name: 'Brazil' },
  { code: '54', iso: 'AR', name: 'Argentina' },
  { code: '53', iso: 'CU', name: 'Cuba' },
  { code: '52', iso: 'MX', name: 'Mexico' },
  { code: '51', iso: 'PE', name: 'Peru' },
  { code: '49', iso: 'DE', name: 'Germany' },
  { code: '48', iso: 'PL', name: 'Poland' },
  { code: '47', iso: 'NO', name: 'Norway' },
  { code: '46', iso: 'SE', name: 'Sweden' },
  { code: '45', iso: 'DK', name: 'Denmark' },
  { code: '44', iso: 'GB', name: 'United Kingdom' },
  { code: '43', iso: 'AT', name: 'Austria' },
  { code: '41', iso: 'CH', name: 'Switzerland' },
  { code: '40', iso: 'RO', name: 'Romania' },
  { code: '39', iso: 'IT', name: 'Italy' },
  { code: '36', iso: 'HU', name: 'Hungary' },
  { code: '34', iso: 'ES', name: 'Spain' },
  { code: '33', iso: 'FR', name: 'France' },
  { code: '32', iso: 'BE', name: 'Belgium' },
  { code: '31', iso: 'NL', name: 'Netherlands' },
  { code: '30', iso: 'GR', name: 'Greece' },
  { code: '27', iso: 'ZA', name: 'South Africa' },
  { code: '20', iso: 'EG', name: 'Egypt' },
  { code: '7', iso: 'RU', name: 'Russia / Kazakhstan' },
  { code: '1', iso: 'US', name: 'United States / Canada' },
];

/**
 * National-number prefixes that indicate a mobile line for a given country code.
 * If a country is absent, destination-type detection falls back to the carrier
 * rate table (ALL / FIXED / MOBILE) without platform-level classification.
 */
export const MOBILE_NATIONAL_PREFIXES: Record<string, string[]> = {
  '30': ['6'], // Greece
  '31': ['6'], // Netherlands
  '32': ['4', '9'], // Belgium
  '33': ['6', '7'], // France
  '34': ['6', '7'], // Spain
  '36': ['2', '3', '4', '5', '6', '7', '8', '9'], // Hungary (all except landline 1)
  '39': ['3', '7'], // Italy
  '40': ['7'], // Romania
  '41': ['7'], // Switzerland
  '43': ['6'], // Austria
  '44': ['7'], // UK
  '45': ['2', '3', '4', '5', '6', '8', '9'], // Denmark (simplified)
  '46': ['7'], // Sweden
  '47': ['4', '9'], // Norway
  '48': ['5', '6', '7', '8', '9'], // Poland (simplified)
  '49': ['15', '16', '17'], // Germany (simplified)
  '351': ['9'], // Portugal
  '353': ['8'], // Ireland
  '356': ['7', '9'], // Malta
  '358': ['4', '5'], // Finland
  '359': ['87', '88', '89', '98'], // Bulgaria
  '370': ['6'], // Lithuania
  '371': ['2'], // Latvia
  '372': ['5'], // Estonia
  '380': ['6', '7', '9'], // Ukraine
  '381': ['6'], // Serbia
  '386': ['3', '4', '5', '6', '7'], // Slovenia
  '420': ['6', '7'], // Czech Republic
  '421': ['9'], // Slovakia
};

export function findCountryByCode(digits: string): CountryInfo | null {
  for (const country of E164_COUNTRY_CODES) {
    if (digits.startsWith(country.code)) return country;
  }
  return null;
}

export function detectMobilePrefix(countryCode: string, nationalNumber: string): boolean {
  const prefixes = MOBILE_NATIONAL_PREFIXES[countryCode];
  if (!prefixes) return false;
  return prefixes.some((prefix) => nationalNumber.startsWith(prefix));
}
