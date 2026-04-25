import axios from "axios";
import { astrologyService } from "./astrologyService";

jest.mock("axios");

describe("astrologyService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("throws with fallback sign data when the live sign list fails", async () => {
    axios.get.mockRejectedValueOnce(new Error("Network down"));

    try {
      await astrologyService.getSigns();
      throw new Error("Expected getSigns to reject.");
    } catch (error) {
      expect(error.message).toBe("Network down");
      expect(error.fallbackData).toEqual(
        expect.arrayContaining([expect.objectContaining({ sign: "aries" })])
      );
    }
  });

  test("throws with a fallback daily reading when the live daily endpoint fails", async () => {
    axios.get.mockRejectedValueOnce({
      response: {
        data: {
          message: "Astrology API is offline",
        },
      },
    });

    try {
      await astrologyService.getDailyHoroscope("leo");
      throw new Error("Expected getDailyHoroscope to reject.");
    } catch (error) {
      expect(error.message).toBe("Astrology API is offline");
      expect(error.fallbackData).toEqual(expect.objectContaining({ sign: "leo" }));
      expect(error.fallbackData.readingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("normalizes the saved astrology profile payload", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          sign: "aries",
          birthDate: "2026-04-23T00:00:00.000Z",
          birthTime: "09:30",
          birthPlace: "Kochi",
          preferences: {
            receiveDailyHoroscope: true,
            favoriteTopics: ["career", "relationships"],
          },
          savedReadings: [
            {
              sign: "aries",
              horoscope: "Stay focused.",
              readingDate: "2026-04-23T00:00:00.000Z",
            },
          ],
        },
      },
    });

    const profile = await astrologyService.getProfile();

    expect(profile).toEqual(
      expect.objectContaining({
        sign: "aries",
        birthDate: "2026-04-23",
        birthTime: "09:30",
        birthPlace: "Kochi",
        preferences: expect.objectContaining({
          receiveDailyHoroscope: true,
          favoriteTopics: ["career", "relationships"],
        }),
      })
    );
    expect(profile.savedReadings[0]).toEqual(
      expect.objectContaining({
        sign: "aries",
        readingDate: "2026-04-23",
      })
    );
  });
});
