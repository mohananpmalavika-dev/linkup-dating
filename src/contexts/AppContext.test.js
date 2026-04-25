import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { AppProvider, useApp } from "./AppContext";

jest.mock("axios");

const batchBackedProduct = {
  id: "prod-1",
  name: "Banana Chips",
  category: "Snacks",
  businessName: "Kerala Foods",
  sellerName: "Seller",
  sellerEmail: "seller@example.com",
  description: "Crunchy chips",
  approvalStatus: "approved",
  image: "C",
  inventoryBatches: [
    {
      id: "batch-1",
      batchLabel: "Lot A",
      stock: 5,
      price: 120,
      mrp: 150,
      location: "Kochi",
      expiryDate: "2026-12-31",
      returnAllowed: true,
      returnWindowDays: 7,
      isActive: true,
    },
    {
      id: "batch-2",
      batchLabel: "Lot B",
      stock: 3,
      price: 135,
      mrp: 155,
      location: "Thrissur",
      expiryDate: "2027-01-15",
      isActive: true,
    },
  ],
};

const ContextProbe = () => {
  const { ecommerceProducts, addToCart, cart, placeOrder } = useApp();

  return (
    <div>
      <div data-testid="product-count">{ecommerceProducts.length}</div>
      {ecommerceProducts.map((product) => (
        <button key={product.id} type="button" onClick={() => addToCart(product)}>
          {`${product.name} ${product.batchLabel}`}
        </button>
      ))}
      <div data-testid="cart-count">{cart.length}</div>
      <button
        type="button"
        onClick={() =>
          placeOrder({
            amount: "INR 255",
            subtotal: "INR 255",
            deliveryFee: "INR 0",
            deliveryAddress: "Test Address",
            deliveryDetails: {},
            items: cart,
          })
        }
      >
        Place Order
      </button>
    </div>
  );
};

describe("AppContext marketplace batch variants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    axios.get.mockImplementation((url) => {
      if (url.includes("/app-data/public")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              moduleData: { ecommerceProducts: [] },
            },
          },
        });
      }

      if (url.includes("/products/manage")) {
        return Promise.resolve({
          data: {
            success: true,
            products: [],
            pagination: { page: 1, limit: 12, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
            counts: { total: 0, pending: 0, approved: 0, rejected: 0, active: 0, disabled: 0 },
          },
        });
      }

      if (url.includes("/products")) {
        return Promise.resolve({
          data: {
            success: true,
            products: [batchBackedProduct],
            pagination: { page: 1, limit: 12, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
          },
        });
      }

      return Promise.resolve({ data: { success: true, orders: [], pagination: {}, stats: {} } });
    });

    axios.post.mockResolvedValue({
      data: {
        success: true,
        order: { id: "order-1" },
      },
    });
  });

  test("exposes each active inventory batch as a separate marketplace item", async () => {
    render(
      <AppProvider>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => {
      expect(Number(screen.getByTestId("product-count").textContent || "0")).toBeGreaterThanOrEqual(2);
    });

    expect(screen.getAllByRole("button", { name: /banana chips lot a/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /banana chips lot b/i }).length).toBeGreaterThan(0);
  });

  test("sends batch metadata in the order payload", async () => {
    render(
      <AppProvider>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /banana chips lot a/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /banana chips lot a/i })[0]);
    await waitFor(() => {
      expect(screen.getByTestId("cart-count")).toHaveTextContent("1");
    });
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/orders"),
        expect.objectContaining({
          items: [
            expect.objectContaining({
              id: "prod-1::batch::batch-1",
              productId: "prod-1",
              batchId: "batch-1",
              batchLabel: "Lot A",
              location: "Kochi",
              expiryDate: "2026-12-31",
              returnAllowed: true,
              returnWindowDays: 7,
            }),
          ],
        }),
        expect.any(Object)
      );
    });
  });
});
