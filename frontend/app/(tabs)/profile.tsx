import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        router.replace('/');
      }
    } catch (error) {
      console.error('Fetch user error:', error);
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
              await fetch(`${backendUrl}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
              });
              router.replace('/');
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
        },
      ]
    );
  };

  const handleExportData = async () => {
    try {
      setExporting(true);
      const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/export`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        
        // Create CSV content
        let csvContent = '';
        
        // Repostajes section
        csvContent += 'REPOSTAJES\n';
        csvContent += 'N° Factura,Gasolinera,Fecha,KM Actuales,Autonomía Antes,Autonomía Después,Litros,Precio/L,Total €,KM Gastados,Consumo L/100km\n';
        data.repostajes.forEach((r: any) => {
          csvContent += `${r.numero_factura},${r.gasolinera},${r.fecha},${r.km_actuales},${r.autonomia_antes},${r.autonomia_despues},${r.litros},${r.precio_litro},${r.total_euros},${r.km_gastados || ''},${r.consumo_l100km || ''}\n`;
        });
        
        csvContent += '\n\n';
        
        // Almacén section
        csvContent += 'ALMACÉN\n';
        csvContent += 'Fecha Compra,Recambio,Marca,Coste €,Estado\n';
        data.almacen.forEach((a: any) => {
          csvContent += `${a.fecha_compra},${a.recambio},${a.marca},${a.coste_euros},${a.estado}\n`;
        });
        
        csvContent += '\n\n';
        
        // Taller section
        csvContent += 'TALLER\n';
        csvContent += 'Fecha Montaje,KM Montaje,Recambio Instalado,Notas\n';
        data.taller.forEach((t: any) => {
          const notas = (t.notas || '').replace(/,/g, ';');
          csvContent += `${t.fecha_montaje},${t.km_montaje},${t.recambio_instalado},${notas}\n`;
        });
        
        // Save file
        const fileName = `vehiculo_${new Date().toISOString().split('T')[0]}.csv`;
        const fileUri = FileSystem.documentDirectory + fileName;
        
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        
        // Share file
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
          Alert.alert('Exportación Completa', 'Datos exportados correctamente');
        } else {
          Alert.alert('Error', 'No se puede compartir el archivo en este dispositivo');
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'No se pudo exportar los datos');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Info Card */}
      <View style={styles.userCard}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{user?.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {/* Export Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exportar Datos</Text>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExportData}
          disabled={exporting}
          activeOpacity={0.8}
        >
          {exporting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="download-outline" size={24} color="#FFFFFF" />
              <Text style={styles.exportButtonText}>Exportar a CSV/Excel</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.exportHint}>
          Descarga todos tus datos en formato CSV para abrir en Google Sheets o Excel
        </Text>
      </View>

      {/* Stats Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información</Text>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#9CA3AF" />
          <Text style={styles.infoText}>
            Tus datos están sincronizados en la nube y protegidos
          </Text>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
      </TouchableOpacity>

      {/* Version Info */}
      <Text style={styles.versionText}>Gestión de Vehículo v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },
  content: {
    padding: 16,
  },
  userCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  exportButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  exportHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#9CA3AF',
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    marginTop: 16,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  versionText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
});
