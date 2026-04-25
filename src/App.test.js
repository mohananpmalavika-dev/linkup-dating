import { fireEvent, render, screen, within } from "@testing-library/react";
import axios from "axios";
import App from "./App";

jest.mock("axios");

const createPublicAppData = (overrides = {}) => ({
  businessCategories: [
    { id: "ecommerce", name: "GlobeMart", fee: 799, requiresFoodLicense: false },
    { id: "messaging", name: "LinkUp", fee: 999, requiresFoodLicense: false },
    { id: "fooddelivery", name: "Feastly", fee: 1999, requiresFoodLicense: true },
  ],
  globeMartCategories: ["Snacks", "Spices"],
  enabledModules: ["ecommerce", "messaging", "fooddelivery"],
  registeredAccounts: [
    {
      email: "person@example.com",
      name: "Person",
      roles: ["user", "entrepreneur"],
      selectedBusinessCategories: [{ id: "ecommerce", name: "GlobeMart", fee: 799 }],
    },
  ],
  registrationApplications: [],
  moduleData: {
    ecommerceProducts: [],
    classifiedsListings: [],
    realestateProperties: [],
    restaurants: [],
    rideOffers: [],
    conversations: [],
    matrimonialProfiles: [],
    socialMediaPosts: [],
    socialMediaStories: [],
  },
  ...overrides,
});

const createAdminAppData = (publicAppData) => ({
  ...publicAppData,
  registrationApplications: [
    {
      id: 1,
      businessName: "Person Traders",
      applicantName: "Person",
      email: "person@example.com",
      phone: "9999999999",
      selectedBusinessCategories: [{ id: "ecommerce", name: "GlobeMart", fee: 799 }],
      registrationFee: 799,
      status: "Pending Review",
    },
  ],
});

const mockAxiosForApp = ({
  authUser = null,
  publicAppData = createPublicAppData(),
  adminAppData = createAdminAppData(publicAppData),
  createCategoryMode = "success",
} = {}) => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/app-data/public")) {
      return Promise.resolve({ data: { success: true, data: publicAppData } });
    }

    if (url.includes("/app-data/admin")) {
      return Promise.resolve({ data: { success: true, data: adminAppData } });
    }

    if (url.includes("/auth/me")) {
      if (!authUser) {
        return Promise.resolve({
          status: 401,
          data: {
            success: false,
          },
        });
      }

      return Promise.resolve({
        status: 200,
        data: {
          success: true,
          user: authUser,
        },
      });
    }

    if (url.includes("/products/manage")) {
      return Promise.resolve({
        data: {
          success: true,
          products: [],
          pagination: {
            page: 1,
            limit: 12,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          counts: { total: 0, pending: 0, approved: 0, rejected: 0, active: 0, disabled: 0 },
        },
      });
    }

    if (url.includes("/products")) {
      return Promise.resolve({
        data: {
          success: true,
          products: [],
          pagination: {
            page: 1,
            limit: 12,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      });
    }

    if (url.includes("/orders/mine")) {
      return Promise.resolve({
        data: {
          success: true,
          orders: [],
          pagination: {
            page: 1,
            limit: 10,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          stats: { openCount: 0 },
        },
      });
    }

    if (url.includes("/orders/manage")) {
      return Promise.resolve({
        data: {
          success: true,
          orders: [],
          pagination: {
            page: 1,
            limit: 10,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          stats: { openFulfillmentCount: 0 },
        },
      });
    }

    if (url.includes("/orders/payment-config")) {
      return Promise.resolve({
        data: {
          success: true,
          gateways: {
            stripe: { enabled: false, publishableKey: "" },
            razorpay: { enabled: false, keyId: "" },
          },
        },
      });
    }

    return Promise.resolve({ data: { success: true } });
  });

  axios.post.mockImplementation((url) => {
    if (url.includes("/auth/send-otp")) {
      return Promise.resolve({
        data: {
          success: true,
          message: "OTP sent to your email",
          devOtp: "123456",
        },
      });
    }

    if (url.includes("/auth/verify-otp")) {
      return Promise.resolve({
        data: {
          success: true,
          token: "token",
          user: {
            id: "1",
            email: "person@example.com",
            name: "Person",
            avatar: "P",
          },
        },
      });
    }

    if (url.includes("/app-data/registration-applications")) {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            registrationApplications: adminAppData.registrationApplications,
            registeredAccounts: publicAppData.registeredAccounts,
          },
        },
      });
    }

    if (url.includes("/app-data/globemart-categories")) {
      if (createCategoryMode === "missing-endpoint") {
        return Promise.reject({
          response: {
            status: 404,
            data: {
              message: "API endpoint not found",
            },
          },
        });
      }

      return Promise.resolve({
        data: {
          success: true,
          data: {
            globeMartCategories: [...publicAppData.globeMartCategories, "Bakery"],
          },
        },
      });
    }

    return Promise.resolve({ data: { success: true } });
  });

  axios.patch.mockImplementation((url, payload) => {
    if (url.includes("/auth/me")) {
      return Promise.resolve({
        data: {
          success: true,
          user: {
            ...(authUser || {}),
            ...(payload || {}),
          },
        },
      });
    }

    if (url.includes("/app-data/enabled-modules")) {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            enabledModules: publicAppData.enabledModules,
          },
        },
      });
    }

    return Promise.resolve({ data: { success: true } });
  });

  axios.put.mockResolvedValue({
    data: {
      success: true,
      data: {
        businessCategories: publicAppData.businessCategories,
      },
    },
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  window.open = jest.fn();
});

test("renders the launch screen when the backend reports no active session", async () => {
  mockAxiosForApp();

  render(<App />);

  expect(
    await screen.findByRole("heading", { level: 1, name: /kerala super app/i })
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /register as a user/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /register as an entrepreneur/i })).toBeInTheDocument();
});

test("shows saved custom links on the launch page next to enabled categories", async () => {
  localStorage.setItem(
    "malabarbazaar-custom-links",
    JSON.stringify([
      {
        id: "custom-link-facebook",
        title: "Facebook",
        url: "https://www.facebook.com/",
        description: "Open your Facebook feed quickly.",
      },
    ])
  );
  mockAxiosForApp();

  render(<App />);

  expect(
    await screen.findByRole("button", { name: /facebook open your facebook feed quickly\./i })
  ).toBeInTheDocument();
});

test("shows Local Market and AstroNila on the launch page when they are enabled", async () => {
  mockAxiosForApp({
    publicAppData: createPublicAppData({
      enabledModules: ["ecommerce", "localmarket", "astrology"],
    }),
  });

  render(<App />);

  expect(await screen.findByRole("button", { name: /local market/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /astronila/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /linkup/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /feastly/i })).not.toBeInTheDocument();
});

test("shows login as user or entrepreneur options", async () => {
  mockAxiosForApp();

  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: /login/i }));

  expect(
    screen.getByRole("heading", { level: 2, name: /verify your email/i })
  ).toBeInTheDocument();
  expect(screen.getByRole("group", { name: /login as/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/^user$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^entrepreneur$/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /send login otp/i })).toBeInTheDocument();
});

test("allows the admin email to use entrepreneur login without prior registration", async () => {
  mockAxiosForApp();

  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /login/i }));

  fireEvent.click(screen.getByLabelText(/^entrepreneur$/i));
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: "mgdhanyamohan@gmail.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: /send login otp/i }));

  expect(screen.queryByText(/not registered as a entrepreneur/i)).not.toBeInTheDocument();
});

test("opens the business registration form with fee and food-license handling", async () => {
  mockAxiosForApp();

  render(<App />);

  fireEvent.click(
    await screen.findByRole("button", { name: /register as an entrepreneur/i })
  );

  expect(
    screen.getByRole("heading", { level: 2, name: /create your business account/i })
  ).toBeInTheDocument();
  expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/account type/i)).toHaveValue("business");
  expect(screen.getByRole("group", { name: /business categories/i })).toBeInTheDocument();
  expect(screen.getByText(/^inr 0$/i)).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText(/globemart/i));
  fireEvent.click(screen.getByLabelText(/linkup/i));

  expect(screen.getByText(/^inr 1798$/i)).toBeInTheDocument();
  expect(
    screen.getByLabelText(/i understand that the total registration fee is inr 1798/i)
  ).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText(/feastly/i));

  expect(
    screen.getByRole("heading", { level: 3, name: /food licence details/i })
  ).toBeInTheDocument();
});

test("logout returns an authenticated user to the launch page", async () => {
  mockAxiosForApp({
    authUser: {
      id: "1",
      email: "person@example.com",
      name: "Person",
      avatar: "P",
      registrationType: "user",
      role: "user",
    },
  });

  render(<App />);

  fireEvent.click((await screen.findAllByText(/^person$/i))[0]);
  fireEvent.click(screen.getByRole("button", { name: /logout/i }));

  expect(
    await screen.findByRole("heading", { level: 1, name: /kerala super app/i })
  ).toBeInTheDocument();
});

test("shows saved custom links on the dashboard for logged in users", async () => {
  localStorage.setItem(
    "malabarbazaar-custom-links",
    JSON.stringify([
      {
        id: "custom-link-gmail",
        title: "Gmail",
        url: "https://mail.google.com/",
        description: "Jump into Gmail from the dashboard.",
      },
    ])
  );
  mockAxiosForApp({
    authUser: {
      id: "1",
      email: "person@example.com",
      name: "Person",
      avatar: "P",
      registrationType: "user",
      role: "user",
    },
  });

  render(<App />);

  expect(
    await screen.findByRole("button", { name: /gmail jump into gmail from the dashboard\./i })
  ).toBeInTheDocument();
});

test("home navigation hides modules disabled by the admin", async () => {
  mockAxiosForApp({
    authUser: {
      id: "1",
      email: "person@example.com",
      name: "Person",
      avatar: "P",
      registrationType: "user",
      role: "user",
    },
    publicAppData: createPublicAppData({
      enabledModules: ["ecommerce", "messaging"],
    }),
  });

  render(<App />);

  expect(
    await screen.findByRole("heading", { level: 1, name: /welcome to nilahub/i })
  ).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /globemart/i }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("button", { name: /linkup/i }).length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: /feastly/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^sos$/i })).not.toBeInTheDocument();
});

test("admin can create GlobeMart product categories", async () => {
  mockAxiosForApp({
    authUser: {
      id: "admin-1",
      email: "mgdhanyamohan@gmail.com",
      name: "Admin",
      avatar: "A",
      registrationType: "admin",
      role: "admin",
    },
  });

  render(<App />);

  expect(
    await screen.findByRole("heading", { level: 1, name: /admin dashboard/i })
  ).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/^category name$/i), {
    target: { value: "Bakery" },
  });
  fireEvent.click(screen.getByRole("button", { name: /create category/i }));

  expect(
    await screen.findByText(/globemart category "bakery" is ready for product forms/i)
  ).toBeInTheDocument();
  expect(screen.getAllByText(/^bakery$/i).length).toBeGreaterThan(0);
});

test("seller product form uses GlobeMart categories from admin app data", async () => {
  mockAxiosForApp({
    authUser: {
      id: "seller-1",
      email: "person@example.com",
      name: "Person",
      avatar: "P",
      businessName: "Person Traders",
      registrationType: "entrepreneur",
      role: "business",
      selectedBusinessCategories: [{ id: "ecommerce", name: "GlobeMart", fee: 799 }],
    },
  });

  render(<App />);

  expect(
    await screen.findByRole("heading", { level: 1, name: /seller dashboard/i })
  ).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole("button", { name: /globemart/i }).slice(-1)[0]);

  expect(
    await screen.findByRole("heading", { level: 2, name: /create product for approval/i })
  ).toBeInTheDocument();
  expect(screen.getAllByLabelText(/category/i)[0]).toHaveValue("Snacks");
  expect(screen.getByRole("option", { name: /snacks/i })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /spices/i })).toBeInTheDocument();
});

test("first SoulMatch visit prompts for profile details prefilled from registration", async () => {
  mockAxiosForApp({
    authUser: {
      id: "user-1",
      email: "person@example.com",
      name: "Person",
      phone: "9999999999",
      age: 31,
      gender: "Woman",
      religion: "Hindu",
      community: "Malayali",
      education: "MBA",
      profession: "Designer",
      location: "Kochi",
      maritalStatus: "Never Married",
      familyDetails: "Close knit family in Kerala",
      bio: "Looking for a kind and grounded partner",
      languages: ["Malayalam", "English"],
      hobbies: ["Travel", "Music"],
      avatar: "P",
      registrationType: "user",
      role: "user",
    },
    publicAppData: createPublicAppData({
      enabledModules: ["ecommerce", "messaging", "matrimonial"],
    }),
  });

  render(<App />);

  fireEvent.click((await screen.findAllByRole("button", { name: /soulmatch/i }))[2]);

  expect(
    await screen.findByRole("heading", {
      level: 2,
      name: /complete your profile before you continue/i,
    })
  ).toBeInTheDocument();
  const profileDialog = screen.getByRole("dialog");

  expect(within(profileDialog).getByDisplayValue("Person")).toBeInTheDocument();
  expect(within(profileDialog).getByDisplayValue("person@example.com")).toBeInTheDocument();
  expect(within(profileDialog).getByDisplayValue("9999999999")).toBeInTheDocument();
  expect(within(profileDialog).getByLabelText(/^age$/i)).toHaveValue(31);
  expect(within(profileDialog).getByLabelText(/^profession$/i)).toHaveValue("Designer");
  expect(within(profileDialog).getByLabelText(/^location$/i)).toHaveValue("Kochi");
  expect(within(profileDialog).getByLabelText(/^family details$/i)).toHaveValue(
    "Close knit family in Kerala"
  );
});

test("enabled SOS module opens the emergency alert workspace", async () => {
  mockAxiosForApp({
    authUser: {
      id: "user-2",
      email: "person@example.com",
      name: "Person",
      avatar: "P",
      registrationType: "user",
      role: "user",
    },
    publicAppData: createPublicAppData({
      enabledModules: ["ecommerce", "messaging", "sosalert"],
    }),
  });

  render(<App />);

  fireEvent.click((await screen.findAllByRole("button", { name: /sos safety center/i }))[2]);

  expect(
    await screen.findByRole("heading", { level: 1, name: /sos safety center/i })
  ).toBeInTheDocument();
  expect(
    screen.getByText(/trigger an sos alert, share your live location, notify trusted contacts/i)
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /send sos alert/i }));

  expect(screen.getByText(/sos alert is live\. trusted contacts are being notified now\./i)).toBeInTheDocument();
  expect(screen.getByText(/current incident/i)).toBeInTheDocument();
});
