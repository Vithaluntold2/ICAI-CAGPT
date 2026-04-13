/**
 * Voice Credits Settings Page
 * Purchase voice credits and manage voice preferences
 */

import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  Crown, 
  Zap, 
  Check, 
  CreditCard,
  Globe,
  Volume2,
  History,
  Settings,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

// Types
interface CreditPackage {
  id: string;
  name: string;
  tier: 'standard' | 'premium';
  minutes: number;
  price: number;
  pricePerMinute: string;
  popular?: boolean;
}

interface VoiceCredits {
  tier: 'free' | 'standard' | 'premium';
  balanceMinutes: number;
  freeMinutesRemaining: number;
  spendingCap: number | null;
  preferences: {
    voice: string;
    language: string;
  };
}

interface UsageRecord {
  id: string;
  createdAt: string;
  tier: string;
  sttDurationSeconds: number;
  ttsCharacters: number;
  voiceUsed: string;
  languageUsed: string;
  chargedUsd: number;
}

interface UsageSummary {
  totalMinutes: string;
  totalCharged: string;
  byProvider: Record<string, number>;
}

export const VoiceCreditsSettings: React.FC = () => {
  const [credits, setCredits] = useState<VoiceCredits | null>(null);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [spendingCap, setSpendingCap] = useState<string>('');
  const [languages, setLanguages] = useState<Record<string, { code: string; name: string }[]>>({});
  
  const { toast } = useToast();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchCredits(),
      fetchPackages(),
      fetchUsage(),
      fetchLanguages(),
    ]);
    setLoading(false);
  };

  const fetchCredits = async () => {
    try {
      const res = await fetch('/api/voice/credits', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCredits(data);
        if (data.spendingCap) {
          setSpendingCap(data.spendingCap.toString());
        }
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/voice/packages', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPackages(data.packages || []);
      }
    } catch (error) {
      console.error('Failed to fetch packages:', error);
    }
  };

  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/voice/usage', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsage(data.history || []);
        setUsageSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    }
  };

  const fetchLanguages = async () => {
    try {
      const res = await fetch('/api/voice/languages', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLanguages(data.languages || {});
      }
    } catch (error) {
      console.error('Failed to fetch languages:', error);
    }
  };

  const purchasePackage = async (packageId: string) => {
    setPurchasing(packageId);
    try {
      // TODO: Integrate with Stripe checkout
      const res = await fetch('/api/voice/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ packageId })
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Credits Purchased!",
          description: `Your new balance: ${data.newBalance.toFixed(1)} minutes`
        });
        fetchCredits();
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Purchase failed');
      }
    } catch (error: any) {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setPurchasing(null);
    }
  };

  const updateSpendingCap = async () => {
    try {
      const res = await fetch('/api/voice/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          spendingCap: spendingCap ? parseFloat(spendingCap) : null 
        })
      });

      if (res.ok) {
        toast({
          title: "Spending Cap Updated",
          description: spendingCap ? `Cap set to $${spendingCap}/month` : "Cap removed"
        });
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        variant: "destructive"
      });
    }
  };

  // Tier badge component
  const TierBadge = ({ tier }: { tier: string }) => {
    if (tier === 'premium') {
      return <Badge className="bg-amber-500 text-black"><Crown className="w-3 h-3 mr-1" />Premium</Badge>;
    }
    if (tier === 'standard') {
      return <Badge className="bg-rai-500"><Zap className="w-3 h-3 mr-1" />Standard</Badge>;
    }
    return <Badge variant="secondary">Free</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Volume2 className="w-8 h-8" />
            Voice Credits
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your voice credits and preferences
          </p>
        </div>
        <TierBadge tier={credits?.tier || 'free'} />
      </div>

      {/* Current Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            Current Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free Minutes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Free Minutes</span>
                <span className="text-sm">{credits?.freeMinutesRemaining?.toFixed(1)} / 30</span>
              </div>
              <Progress value={(credits?.freeMinutesRemaining || 0) / 30 * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">Resets monthly</p>
            </div>

            {/* Paid Credits */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Paid Credits</span>
                <span className="text-lg font-semibold">{credits?.balanceMinutes?.toFixed(1) || 0} min</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {credits?.tier === 'premium' ? '$0.30/min' : '$0.02/min'}
              </p>
            </div>

            {/* Spending This Month */}
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Spent This Month</span>
              <p className="text-lg font-semibold">${usageSummary?.totalCharged || '0.00'}</p>
              {credits?.spendingCap && (
                <p className="text-xs text-muted-foreground">
                  Cap: ${credits.spendingCap}/month
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="packages" className="space-y-6">
        <TabsList>
          <TabsTrigger value="packages">
            <CreditCard className="w-4 h-4 mr-2" />
            Buy Credits
          </TabsTrigger>
          <TabsTrigger value="usage">
            <History className="w-4 h-4 mr-2" />
            Usage History
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Preferences
          </TabsTrigger>
        </TabsList>

        {/* Buy Credits Tab */}
        <TabsContent value="packages">
          <div className="space-y-6">
            {/* Standard Tier */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-rai-500" />
                Standard Tier
              </h2>
              <p className="text-muted-foreground">
                Azure Neural Voices • 50+ Regional Accents • $0.02/min with 30% markup
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {packages.filter(p => p.tier === 'standard').map((pkg) => (
                  <Card key={pkg.id} className={pkg.popular ? 'border-rai-500 ring-1 ring-rai-500' : ''}>
                    {pkg.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-rai-500">Most Popular</Badge>
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle>{pkg.name}</CardTitle>
                      <CardDescription>
                        {pkg.minutes} minutes
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">${pkg.price}</div>
                      <p className="text-sm text-muted-foreground">
                        ${pkg.pricePerMinute}/min
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        className="w-full" 
                        onClick={() => purchasePackage(pkg.id)}
                        disabled={purchasing === pkg.id}
                      >
                        {purchasing === pkg.id ? 'Processing...' : 'Purchase'}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>

            {/* Premium Tier */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                Premium Tier
              </h2>
              <p className="text-muted-foreground">
                OpenAI Whisper + TTS • Highest Quality • $0.30/min with 30% markup
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {packages.filter(p => p.tier === 'premium').map((pkg) => (
                  <Card key={pkg.id} className={pkg.popular ? 'border-amber-500 ring-1 ring-amber-500' : ''}>
                    {pkg.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-amber-500 text-black">Recommended</Badge>
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle>{pkg.name}</CardTitle>
                      <CardDescription>
                        {pkg.minutes} minutes
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">${pkg.price}</div>
                      <p className="text-sm text-muted-foreground">
                        ${pkg.pricePerMinute}/min
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        className="w-full bg-amber-500 hover:bg-amber-600 text-black" 
                        onClick={() => purchasePackage(pkg.id)}
                        disabled={purchasing === pkg.id}
                      >
                        {purchasing === pkg.id ? 'Processing...' : 'Purchase'}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>

            {/* Features Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>Tier Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      <TableHead>Free</TableHead>
                      <TableHead>Standard</TableHead>
                      <TableHead>Premium</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Monthly Minutes</TableCell>
                      <TableCell>30 min</TableCell>
                      <TableCell>Pay as you go</TableCell>
                      <TableCell>Pay as you go</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>STT Provider</TableCell>
                      <TableCell>Whisper (Basic)</TableCell>
                      <TableCell>Deepgram/Whisper</TableCell>
                      <TableCell>OpenAI Whisper HD</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>TTS Provider</TableCell>
                      <TableCell>OpenAI TTS</TableCell>
                      <TableCell>Azure Neural (50+ voices)</TableCell>
                      <TableCell>OpenAI TTS HD</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Regional Accents</TableCell>
                      <TableCell>6 voices</TableCell>
                      <TableCell><Check className="w-4 h-4 text-green-500" /> 50+ voices</TableCell>
                      <TableCell><Check className="w-4 h-4 text-green-500" /> All voices</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Languages</TableCell>
                      <TableCell>All</TableCell>
                      <TableCell>All</TableCell>
                      <TableCell>All</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Cost</TableCell>
                      <TableCell>$0</TableCell>
                      <TableCell>$0.026/min</TableCell>
                      <TableCell>$0.39/min</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Usage History Tab */}
        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>Usage History (Last 30 Days)</CardTitle>
              <CardDescription>
                Total: {usageSummary?.totalMinutes || 0} minutes • 
                Charged: ${usageSummary?.totalCharged || '0.00'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usage.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No voice usage yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Voice/Language</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.slice(0, 20).map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {new Date(record.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {record.sttDurationSeconds > 0 ? 'STT' : 'TTS'}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {record.voiceUsed || '-'}
                            <span className="text-muted-foreground ml-2">
                              {record.languageUsed || ''}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.sttDurationSeconds > 0 
                            ? `${(record.sttDurationSeconds / 60).toFixed(1)} min`
                            : `${record.ttsCharacters} chars`
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          ${record.chargedUsd?.toFixed(4) || '0.0000'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="settings">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Spending Limit</CardTitle>
                <CardDescription>
                  Set a monthly spending cap to control costs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="spending-cap">Monthly Cap (USD)</Label>
                    <Input
                      id="spending-cap"
                      type="number"
                      min="0"
                      step="5"
                      placeholder="No limit"
                      value={spendingCap}
                      onChange={(e) => setSpendingCap(e.target.value)}
                    />
                  </div>
                  <Button onClick={updateSpendingCap} className="mt-6">
                    Save
                  </Button>
                </div>
                {spendingCap && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Voice will stop working when you reach ${spendingCap}/month
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Supported Languages</CardTitle>
                <CardDescription>
                  Languages available with regional accents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(languages).map(([region, langs]) => (
                    <div key={region} className="space-y-2">
                      <h4 className="font-medium capitalize">{region.replace(/([A-Z])/g, ' $1')}</h4>
                      <div className="flex flex-wrap gap-1">
                        {(langs as { code: string; name: string }[]).map((lang) => (
                          <Badge key={lang.code} variant="outline" className="text-xs">
                            {lang.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VoiceCreditsSettings;
