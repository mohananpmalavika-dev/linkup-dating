import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

// Locales
const resources = {
  en: {
    translation: {
      // Ecommerce
      'products.title': 'GlobeMart Products',
      'addToCart': 'Add to Cart',
      'outOfStock': 'Out of Stock',
      'price': 'Price',
      'mrp': 'MRP',
      'discount': 'Save {{amount}} ({{percent}}%)',
      
      // Checkout
      'checkout.title': 'Checkout',
      'deliveryAddress': 'Delivery Address',
      'paymentMethod': 'Payment Method',
      'placeOrder': 'Place Order',
      
      // Common
      'wallet.balance': 'Wallet Balance: {{amount}}',
      'loading': 'Loading...',
      'error': 'Something went wrong'
    }
  },
  ml: {
    translation: {
      // Ecommerce  
      'products.title': 'ഗ്ലോബ്മാർട്ട് ഉൽപ്പന്നങ്ങൾ',
      'addToCart': 'കാർട്ടിലേക്ക് ചേർക്കുക',
      'outOfStock': 'സ്റ്റോക്ക് അല്ല',
      'price': 'വില',
      'mrp': 'MRP',
      'discount': '{{percent}}% കുറവ് ({{amount}} സേവ്)',
      
      // Checkout
      'checkout.title': 'ചെക്കൗട്ട്',
      'deliveryAddress': 'ഡെലിവറി വിലാസം',
      'paymentMethod': 'പേയ്മെന്റ് രീതി',
      'placeOrder': 'ഓർഡർ സ്ഥാപിക്കുക',
      
      // Common
      'wallet.balance': 'വാലറ്റ് ബാലൻസ്: {{amount}}',
      'loading': 'ലോഡ് ചെയ്യുന്നു...',
      'error': 'എന്തോ തെറ്റായി'
    }
  },
  hi: {
    translation: {
      // Ecommerce
      'products.title': 'ग्लोबमार्ट उत्पाद',
      'addToCart': 'कार्ट में जोड़ें',
      'outOfStock': 'स्टॉक में नहीं',
      'price': 'कीमत',
      'mrp': 'MRP',
      'discount': '{{percent}}% छूट ({{amount}} बचाएं)',
      
      // Checkout
      'checkout.title': 'चेकआउट',
      'deliveryAddress': 'डिलीवरी पता',
      'paymentMethod': 'भुगतान विधि',
      'placeOrder': 'ऑर्डर दें',
      
      // Common
      'wallet.balance': 'वॉलेट बैलेंस: {{amount}}',
      'loading': 'लोड हो रहा है...',
      'error': 'कुछ गलत हो गया'
    }
  },
  ta: {
    translation: {
      // Ecommerce
      'products.title': 'கிளோப்மார்ட் பொருட்கள்',
      'addToCart': 'கார்டில் சேர்க்கவும்',
      'outOfStock': 'பங்கு இல்லை',
      'price': 'விலை',
      'mrp': 'MRP',
      'discount': '{{percent}}% தள்ளுபடி ({{amount}} சேமிக்கவும்)',
      
      // Checkout
      'checkout.title': 'செக்அவுட்',
      'deliveryAddress': 'டெலிவரி முகவரி',
      'paymentMethod': 'பரிவர்த்தனை முறை',
      'placeOrder': 'ஆர்டரை பதிவு செய்யவும்',
      
      // Common
      'wallet.balance': 'வாலெட் இருப்பு: {{amount}}',
      'loading': 'ஏற்றுகிறது...',
      'error': 'ஏதோ தவறு'
    }
  },
  ar: {
    translation: {
      // Ecommerce
      'products.title': 'منتجات GlobeMart',
      'addToCart': 'إضافة إلى السلة',
      'outOfStock': 'نفد المخزون',
      'price': 'السعر',
      'mrp': 'MRP',
      'discount': 'وفر {{amount}} ({{percent}}%)',
      
      // Checkout
      'checkout.title': 'الدفع',
      'deliveryAddress': 'عنوان التوصيل',
      'paymentMethod': 'طريقة الدفع',
      'placeOrder': 'اطلب الآن',
      
      // Common
      'wallet.balance': 'رصيد المحفظة: {{amount}}',
      'loading': 'جار التحميل...',
      'error': 'حدث خطأ'
    }
  },
  te: {
    translation: {
      // Ecommerce
      'products.title': 'గ్లోబ్‌మార్ట్ ఉత్పత్తులు',
      'addToCart': 'కార్ట్‌లో జోడించండి',
      'outOfStock': 'స్టాక్ లేదు',
      'price': 'ధర',
      'mrp': 'MRP',
      'discount': '{{percent}}% డిస్కౌంట్ ({{amount}} సేవ్)',
      
      // Checkout
      'checkout.title': 'చెక్అవుట్',
      'deliveryAddress': 'డెలివరీ చిరునామా',
      'paymentMethod': 'చెల్లింపు పద్ధతి',
      'placeOrder': 'ఆర్డర్ ఇవ్వండి',
      
      // Common
      'wallet.balance': 'వాలెట్ బ్యాలెన్స్: {{amount}}',
      'loading': 'లోడ్ అవుతోంది...',
      'error': 'ఏదో తప్పు'
    }
  },
  kn: {
    translation: {
      // Ecommerce
      'products.title': 'GlobeMart ಉತ್ಪನ್ನಗಳು',
      'addToCart': 'ಕಾರ್ಟ್‌ಗೆ ಸೇರಿಸಿ',
      'outOfStock': 'ಸ್ಟಾಕ್ ಇಲ್ಲ',
      'price': 'ಬೆಲೆ',
      'mrp': 'MRP',
      'discount': '{{percent}}% ರಿಯಾಯಿತಿ ({{amount}} ಉಳಿಸಿ)',
      
      // Checkout
      'checkout.title': 'ಚೆಕ್‌ಔಟ್',
      'deliveryAddress': 'ಡೆಲಿವರಿ ವಿಳಾಸ',
      'paymentMethod': 'ಪಾವತಿ ವಿಧಾನ',
      'placeOrder': 'ಆರ್ಡರ್ ನೀಡಿ',
      
      // Common
      'wallet.balance': 'ವಾಲೆಟ್ ಶೇಖರಣೆ: {{amount}}',
      'loading': 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
      'error': 'ಏನಾದರೂ ತಪ್ಪು'
    }
  },
  bn: {
    translation: {
      // Ecommerce
      'products.title': 'গ্লোবমার্ট প্রোডাক্ট',
      'addToCart': 'কার্টে যোগ করুন',
      'outOfStock': 'স্টক নেই',
      'price': 'মূল্য',
      'mrp': 'MRP',
      'discount': '{{percent}}% ছাড় ({{amount}} সেভ)',
      
      // Checkout
      'checkout.title': 'চেকআউট',
      'deliveryAddress': 'ডেলিভারি ঠিকানা',
      'paymentMethod': 'পেমেন্ট পদ্ধতি',
      'placeOrder': 'অর্ডার করুন',
      
      // Common
      'wallet.balance': 'ওয়ালেট ব্যালেন্স: {{amount}}',
      'loading': 'লোড হচ্ছে...',
      'error': 'কিছু ভুল হয়েছে'
    }
  }
};

i18n
  .use(HttpBackend) // Load translations dynamically
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    lng: 'en', // Default
    interpolation: {
      escapeValue: false // React handles escaping
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage']
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json' // Optional remote loading
    }
  });

export default i18n;

