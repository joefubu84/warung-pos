import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { requireAdminAuth } from '@/lib/auth-guard';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export const Route = createFileRoute('/settings')({
  ssr: false,
  beforeLoad: async ({ location, context }) => {
    return await requireAdminAuth(location, context.auth);
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { storeId } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ['store', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: printerSettings, isLoading: printerLoading } = useQuery({
    queryKey: ['printer-settings', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printer_settings')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const updateStoreMutation = useMutation({
    mutationFn: async (values: { logo_url: string; phone_number: string; phone_number_2: string }) => {
      const { data, error } = await supabase
        .from('stores')
        .update({
          logo_url: values.logo_url,
          phone_number: values.phone_number,
          phone_number_2: values.phone_number_2,
        })
        .eq('id', storeId)
        .select('id, logo_url, phone_number, phone_number_2');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Store was not updated — you may not have permission to edit this store.');
      }
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store', storeId] });
      toast.success('Store info updated');
    },
    onError: (error) => toast.error(error.message),
  });

  const updatePrinterMutation = useMutation({
    mutationFn: async (values: { printer_name: string; print_on_status: string[] }) => {
      if (printerSettings) {
        const { error } = await supabase
          .from('printer_settings')
          .update({
            printer_name: values.printer_name,
            print_on_status: values.print_on_status,
            auto_print: values.print_on_status.length > 0
          })
          .eq('store_id', storeId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('printer_settings')
          .insert({
            store_id: storeId,
            printer_name: values.printer_name,
            print_on_status: values.print_on_status,
            auto_print: values.print_on_status.length > 0
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printer-settings', storeId] });
      toast.success('Printer settings updated');
    },
    onError: (error) => toast.error(error.message),
  });

  const [storeForm, setStoreForm] = useState({ logo_url: '', phone_number: '', phone_number_2: '' });
  const [printerForm, setPrinterForm] = useState({ printer_name: '', print_on_status: [] as string[] });

  useEffect(() => {
    if (store) {
      setStoreForm({
        logo_url: store.logo_url || '',
        phone_number: store.phone_number || '',
        phone_number_2: (store as any).phone_number_2 || '',
      });
    }
  }, [store]);

  useEffect(() => {
    if (printerSettings) {
      setPrinterForm({
        printer_name: printerSettings.printer_name || '',
        print_on_status: printerSettings.print_on_status || [],
      });
    }
  }, [printerSettings]);

  if (storeLoading || printerLoading) return <div className="p-8 text-center">Loading settings...</div>;

  const handleToggleStatus = (status: string) => {
    setPrinterForm(prev => ({
      ...prev,
      print_on_status: prev.print_on_status.includes(status)
        ? prev.print_on_status.filter(s => s !== status)
        : [...prev.print_on_status, status]
    }));
  };

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-8 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Store Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="logo">Store Logo</Label>
            <div className="flex items-center gap-4">
              {storeForm.logo_url && (
                <img 
                  src={storeForm.logo_url} 
                  alt="Store logo" 
                  className="w-16 h-16 object-contain border rounded bg-slate-50"
                />
              )}
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  try {
                    const filePath = `${storeId}/logo.png`;
                    
                    // Upload file to Supabase Storage
                    const { error: uploadError } = await supabase.storage
                      .from('logos')
                      .upload(filePath, file, { 
                        upsert: true,
                        contentType: 'image/png'
                      });
                    
                    if (uploadError) throw uploadError;

                    // Get public URL (cache-busted so the browser shows the new file)
                    const { data: { publicUrl } } = supabase.storage
                      .from('logos')
                      .getPublicUrl(filePath);
                    const bustedUrl = `${publicUrl}?v=${Date.now()}`;

                    setStoreForm(prev => ({ ...prev, logo_url: bustedUrl }));

                    // Persist the URL immediately so it can't be lost
                    const { data: updated, error: updateError } = await supabase
                      .from('stores')
                      .update({ logo_url: bustedUrl })
                      .eq('id', storeId)
                      .select('id, logo_url');
                    if (updateError) throw updateError;
                    if (!updated || updated.length === 0) {
                      throw new Error('Logo URL could not be saved — admin permission required.');
                    }

                    queryClient.invalidateQueries({ queryKey: ['store', storeId] });
                    toast.success('Logo uploaded and saved');
                  } catch (error: any) {
                    toast.error(`Upload failed: ${error.message}`);
                  }
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number 1</Label>
            <Input
              id="phone"
              value={storeForm.phone_number}
              onChange={(e) => setStoreForm(prev => ({ ...prev, phone_number: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone2">Phone Number 2</Label>
            <Input
              id="phone2"
              value={storeForm.phone_number_2}
              onChange={(e) => setStoreForm(prev => ({ ...prev, phone_number_2: e.target.value }))}
            />
          </div>
          <Button 
            className="w-full" 
            onClick={() => updateStoreMutation.mutate(storeForm)}
            disabled={updateStoreMutation.isPending}
          >
            {updateStoreMutation.isPending ? 'Saving...' : 'Save Store Info'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Printer Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="printer_name">Printer Name</Label>
            <Input
              id="printer_name"
              placeholder='e.g. "POS-5810dd Counter"'
              value={printerForm.printer_name}
              onChange={(e) => setPrinterForm(prev => ({ ...prev, printer_name: e.target.value }))}
            />
          </div>
          
          <div className="space-y-3">
            <Label>Auto-print Trigger</Label>
            {[
              { id: 'payment_confirmed', label: 'On Payment Confirmed' },
              { id: 'ready', label: 'On Order Ready' },
              { id: 'completed', label: 'On Order Completed' },
            ].map((trigger) => (
              <div key={trigger.id} className="flex items-center space-x-2">
                <Checkbox
                  id={trigger.id}
                  checked={printerForm.print_on_status.includes(trigger.id)}
                  onCheckedChange={() => handleToggleStatus(trigger.id)}
                />
                <Label htmlFor={trigger.id} className="font-normal">{trigger.label}</Label>
              </div>
            ))}
          </div>

          <Button 
            className="w-full" 
            onClick={() => updatePrinterMutation.mutate(printerForm)}
            disabled={updatePrinterMutation.isPending}
          >
            {updatePrinterMutation.isPending ? 'Saving...' : 'Save Printer Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
