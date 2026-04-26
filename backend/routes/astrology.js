const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// All zodiac signs with their details
const ZODIAC_SIGNS = [
  {
    id: 1,
    name: 'Aries',
    symbol: '♈',
    dateStart: 'March 21',
    dateEnd: 'April 19',
    element: 'Fire',
    ruling: 'Mars'
  },
  {
    id: 2,
    name: 'Taurus',
    symbol: '♉',
    dateStart: 'April 20',
    dateEnd: 'May 20',
    element: 'Earth',
    ruling: 'Venus'
  },
  {
    id: 3,
    name: 'Gemini',
    symbol: '♊',
    dateStart: 'May 21',
    dateEnd: 'June 20',
    element: 'Air',
    ruling: 'Mercury'
  },
  {
    id: 4,
    name: 'Cancer',
    symbol: '♋',
    dateStart: 'June 21',
    dateEnd: 'July 22',
    element: 'Water',
    ruling: 'Moon'
  },
  {
    id: 5,
    name: 'Leo',
    symbol: '♌',
    dateStart: 'July 23',
    dateEnd: 'August 22',
    element: 'Fire',
    ruling: 'Sun'
  },
  {
    id: 6,
    name: 'Virgo',
    symbol: '♍',
    dateStart: 'August 23',
    dateEnd: 'September 22',
    element: 'Earth',
    ruling: 'Mercury'
  },
  {
    id: 7,
    name: 'Libra',
    symbol: '♎',
    dateStart: 'September 23',
    dateEnd: 'October 22',
    element: 'Air',
    ruling: 'Venus'
  },
  {
    id: 8,
    name: 'Scorpio',
    symbol: '♏',
    dateStart: 'October 23',
    dateEnd: 'November 21',
    element: 'Water',
    ruling: 'Pluto'
  },
  {
    id: 9,
    name: 'Sagittarius',
    symbol: '♐',
    dateStart: 'November 22',
    dateEnd: 'December 21',
    element: 'Fire',
    ruling: 'Jupiter'
  },
  {
    id: 10,
    name: 'Capricorn',
    symbol: '♑',
    dateStart: 'December 22',
    dateEnd: 'January 19',
    element: 'Earth',
    ruling: 'Saturn'
  },
  {
    id: 11,
    name: 'Aquarius',
    symbol: '♒',
    dateStart: 'January 20',
    dateEnd: 'February 18',
    element: 'Air',
    ruling: 'Uranus'
  },
  {
    id: 12,
    name: 'Pisces',
    symbol: '♓',
    dateStart: 'February 19',
    dateEnd: 'March 20',
    element: 'Water',
    ruling: 'Neptune'
  }
];

// GET ALL ZODIAC SIGNS
router.get('/signs', async (req, res) => {
  try {
    res.json({
      success: true,
      data: ZODIAC_SIGNS
    });
  } catch (error) {
    console.error('Get signs error:', error);
    res.status(500).json({ error: 'Failed to get zodiac signs' });
  }
});

// GET DAILY HOROSCOPE FOR A SIGN
router.get('/daily/:sign', async (req, res) => {
  try {
    const sign = req.params.sign.toLowerCase();
    const signData = ZODIAC_SIGNS.find(s => s.name.toLowerCase() === sign);

    if (!signData) {
      return res.status(404).json({ error: 'Zodiac sign not found' });
    }

    res.json({
      success: true,
      data: {
        sign: signData.name,
        date: new Date().toISOString().split('T')[0],
        horoscope: 'Your stars are aligned today. Focus on positive energy and good things will follow.',
        mood: 'Optimistic',
        luckyColor: '#FF6B6B',
        luckyNumber: 7,
        compatibility: ['Libra', 'Aquarius']
      }
    });
  } catch (error) {
    console.error('Get daily horoscope error:', error);
    res.status(500).json({ error: 'Failed to get horoscope' });
  }
});

// GET USER'S ASTROLOGY PROFILE
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    res.json({
      success: true,
      data: {
        userId,
        zodiacSign: null,
        birthDate: null,
        birthTime: null,
        birthCity: null,
        interests: []
      }
    });
  } catch (error) {
    console.error('Get astrology profile error:', error);
    res.status(500).json({ error: 'Failed to get astrology profile' });
  }
});

// UPDATE USER'S ASTROLOGY PROFILE
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { zodiacSign, birthDate, birthTime, birthCity, interests } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    res.json({
      success: true,
      message: 'Astrology profile updated',
      data: {
        userId,
        zodiacSign,
        birthDate,
        birthTime,
        birthCity,
        interests
      }
    });
  } catch (error) {
    console.error('Update astrology profile error:', error);
    res.status(500).json({ error: 'Failed to update astrology profile' });
  }
});

module.exports = router;
