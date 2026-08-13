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
    mutationFn: async (values: { 
      printer_name: string; 
      print_on_status: string[];
      sound_choice: string;
      sound_file_url: string | null;
      badge_colors: Record<string, string>;
    }) => {
      if (printerSettings) {
        const { error } = await supabase
          .from('printer_settings')
          .update({
            printer_name: values.printer_name,
            print_on_status: values.print_on_status,
            auto_print: values.print_on_status.length > 0,
            sound_choice: values.sound_choice,
            sound_file_url: values.sound_file_url,
            badge_colors: values.badge_colors
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
            auto_print: values.print_on_status.length > 0,
            sound_choice: values.sound_choice,
            sound_file_url: values.sound_file_url,
            badge_colors: values.badge_colors
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printer-settings', storeId] });
      toast.success('Printer and Kitchen settings updated');
    },
    onError: (error) => toast.error(error.message),
  });

  const [storeForm, setStoreForm] = useState({ logo_url: '', phone_number: '', phone_number_2: '' });
  const [printerForm, setPrinterForm] = useState({ 
    printer_name: '', 
    print_on_status: [] as string[],
    sound_choice: 'kitchen_bell',
    sound_file_url: null as string | null,
    badge_colors: {
      dineIn: '#3B82F6',
      takeaway: '#F97316',
      delivery: '#8B5CF6',
      specialRequests: '#EC4899'
    } as Record<string, string>
  });

  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

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
        sound_choice: printerSettings.sound_choice || 'kitchen_bell',
        sound_file_url: printerSettings.sound_file_url || null,
        badge_colors: (printerSettings.badge_colors as Record<string, string>) || {
          dineIn: '#3B82F6',
          takeaway: '#F97316',
          delivery: '#8B5CF6',
          specialRequests: '#EC4899'
        }
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

  const handleTestSound = async () => {
    const { playKitchenSound } = await import('@/lib/sounds');
    playKitchenSound(printerForm.sound_choice, printerForm.sound_file_url);
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        await handleSoundUpload(file);
        stream.getTracks().forEach(track => track.stop());
      };
      
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      toast.error('Microphone access denied or unavailable');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const handleSoundUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      return toast.error('File size must be less than 5MB');
    }
    
    try {
      const filePath = `${storeId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('sounds')
        .upload(filePath, file, { upsert: true });
        
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('sounds')
        .getPublicUrl(filePath);
        
      setPrinterForm(prev => ({ 
        ...prev, 
        sound_choice: 'custom',
        sound_file_url: publicUrl 
      }));
      toast.success('Sound uploaded successfully');
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    }
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
          <CardTitle>Kitchen Display & Printer Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
          
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-bold text-lg">🔊 Kitchen Alert Sounds</h3>
            
            <div className="space-y-2">
              <Label>Select Sound</Label>
              <div className="grid grid-cols-2 gap-2">
                {['kitchen_bell', 'beep_alert', 'ding_dong', 'whistle', 'buzzer', 'custom'].map(choice => (
                  <div key={choice} className="flex items-center space-x-2">
                    <input 
                      type="radio" 
                      id={`sound-${choice}`} 
                      name="sound_choice" 
                      value={choice}
                      checked={printerForm.sound_choice === choice}
                      onChange={(e) => setPrinterForm(prev => ({ ...prev, sound_choice: e.target.value }))}
                      className="cursor-pointer"
                    />
                    <Label htmlFor={`sound-${choice}`} className="cursor-pointer capitalize">
                      {choice.replace('_', ' ')}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleTestSound}>
                Test Current Sound
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Upload Custom Sound (MP3/WAV/WebM max 5MB)</Label>
              <Input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleSoundUpload(file);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Or Record Voice Message</Label>
              <div>
                {!isRecording ? (
                  <Button type="button" variant="outline" onClick={handleStartRecording} className="text-red-500 hover:text-red-700">
                    🔴 Record Voice
                  </Button>
                ) : (
                  <Button type="button" variant="destructive" onClick={handleStopRecording} className="animate-pulse">
                    ⏹ Stop Recording
                  </Button>
                )}
              </div>
            </div>
            {printerForm.sound_file_url && printerForm.sound_choice === 'custom' && (
              <p className="text-sm text-green-600">✓ Custom sound ready</p>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-bold text-lg">🎨 Badge Colors</h3>
            <div className="grid grid-cols-2 gap-4">
              {['dineIn', 'takeaway', 'delivery', 'specialRequests'].map(key => (
                <div key={key} className="space-y-1">
                  <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={printerForm.badge_colors[key]}
                      onChange={(e) => setPrinterForm(prev => ({
                        ...prev,
                        badge_colors: { ...prev.badge_colors, [key]: e.target.value }
                      }))}
                      className="h-10 w-10 p-1 rounded border"
                    />
                    <Input
                      value={printerForm.badge_colors[key]}
                      onChange={(e) => setPrinterForm(prev => ({
                        ...prev,
                        badge_colors: { ...prev.badge_colors, [key]: e.target.value }
                      }))}
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button 
            className="w-full mt-4" 
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
