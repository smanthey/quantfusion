
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Edit, Trash2 } from "lucide-react";
import { Link } from "wouter";

export default function OrdersPage() {
  // Mock data for orders
  const orders = [
    {
      id: "ORD-001",
      symbol: "BTCUSDT",
      type: "LIMIT",
      side: "BUY",
      amount: 0.5,
      price: 43500,
      status: "PENDING",
      timestamp: "2024-01-08 14:30:00"
    },
    {
      id: "ORD-002", 
      symbol: "ETHUSDT",
      type: "MARKET",
      side: "SELL",
      amount: 2.0,
      price: 2485,
      status: "FILLED",
      timestamp: "2024-01-08 14:25:00"
    },
    {
      id: "ORD-003",
      symbol: "BTCUSDT", 
      type: "STOP_LOSS",
      side: "SELL",
      amount: 0.25,
      price: 42000,
      status: "ACTIVE",
      timestamp: "2024-01-08 14:20:00"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "FILLED": return "bg-green-100 text-green-800";
      case "PENDING": return "bg-yellow-100 text-yellow-800";
      case "ACTIVE": return "bg-blue-100 text-blue-800";
      case "CANCELLED": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Order Management</h1>
              <p className="text-muted-foreground">Manage your trading orders</p>
            </div>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
        </div>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle>Active & Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{order.symbol}</TableCell>
                    <TableCell>{order.type}</TableCell>
                    <TableCell>
                      <Badge variant={order.side === "BUY" ? "default" : "secondary"}>
                        {order.side}
                      </Badge>
                    </TableCell>
                    <TableCell>{order.amount}</TableCell>
                    <TableCell>${order.price.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{order.timestamp}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
