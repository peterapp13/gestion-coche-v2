import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';

interface TallerItem {
  taller_id: string;
  fecha_montaje: string;
  km_montaje: number;
  recambio_instalado: string;
  almacen_id?: string;
  notas?: string;
}

interface AlmacenItem {
  almacen_id: string;
  recambio: string;
  marca: string;
  estado: string;
}

export default function TallerScreen() {
  const router = useRouter();
  const [items, setItems] = useState<TallerItem[]>([]);
  const [almacenItems, setAlmacenItems] = useState<AlmacenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [useCustomPart, setUseCustomPart] = useState(false);
  const [formData, setFormData] = useState({
    fecha_montaje: new Date().toISOString().split('T')[0],
    km_montaje: '',
    recambio_instalado: '',
    almacen_id: '',
    notas: '',
  });

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    try {
      const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
      const authResponse = await fetch(`${backendUrl}/api/auth/me`, {
        credentials: 'include',
      });

      if (!authResponse.ok) {
        router.replace('/');
        return;
      }

      fetchItems();
      fetchAlmacenItems();
    } catch (error) {
      console.error('Auth check error:', error);
      router.replace('/');
    }
  };

  const fetchItems = async () => {
    try {
      const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/taller`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAlmacenItems = async () => {
    try {
      const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/almacen`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Only show pending items
        setAlmacenItems(data.filter((item: AlmacenItem) => item.estado === 'Pendiente'));
      }
    } catch (error) {
      console.error('Fetch almacen error:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchItems();
    fetchAlmacenItems();
  };

  const handleSubmit = async () => {
    try {
      const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
      
      let recambioName = formData.recambio_instalado;
      let almacenId = null;
      
      if (!useCustomPart && formData.almacen_id) {
        // Using part from storage
        const selectedPart = almacenItems.find(item => item.almacen_id === formData.almacen_id);
        if (selectedPart) {
          recambioName = `${selectedPart.recambio} (${selectedPart.marca})`;
          almacenId = formData.almacen_id;
        }
      }
      
      const response = await fetch(`${backendUrl}/api/taller`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          fecha_montaje: formData.fecha_montaje,
          km_montaje: parseFloat(formData.km_montaje),
          recambio_instalado: recambioName,
          almacen_id: almacenId,
          notas: formData.notas || null,
        }),
      });

      if (response.ok) {
        setModalVisible(false);
        resetForm();
        fetchItems();
        fetchAlmacenItems();
      }
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Eliminar registro',
      '¿Estás seguro de que quieres eliminar este registro de taller?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
              const response = await fetch(`${backendUrl}/api/taller/${id}`, {
                method: 'DELETE',
                credentials: 'include',
              });

              if (response.ok) {
                fetchItems();
              }
            } catch (error) {
              console.error('Delete error:', error);
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      fecha_montaje: new Date().toISOString().split('T')[0],
      km_montaje: '',
      recambio_instalado: '',
      almacen_id: '',
      notas: '',
    });
    setUseCustomPart(false);
  };

  const renderItem = ({ item }: { item: TallerItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.recambio_instalado}</Text>
          <Text style={styles.cardSubtitle}>Fecha: {item.fecha_montaje}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(item.taller_id)}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.row}>
          <Text style={styles.label}>KM de Montaje:</Text>
          <Text style={styles.value}>{item.km_montaje.toLocaleString()} km</Text>
        </View>
        {item.notas && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notas:</Text>
            <Text style={styles.notesText}>{item.notas}</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.taller_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#4285F4"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="construct-outline" size={64} color="#6B7280" />
            <Text style={styles.emptyText}>No hay trabajos registrados</Text>
            <Text style={styles.emptySubtext}>Toca el botón + para añadir uno</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Trabajo</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form}>
              <Text style={styles.inputLabel}>Fecha de Montaje</Text>
              <TextInput
                style={styles.input}
                value={formData.fecha_montaje}
                onChangeText={(text) => setFormData({ ...formData, fecha_montaje: text })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#6B7280"
              />

              <Text style={styles.inputLabel}>KM del Vehículo</Text>
              <TextInput
                style={styles.input}
                value={formData.km_montaje}
                onChangeText={(text) => setFormData({ ...formData, km_montaje: text })}
                placeholder="50000"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
              />

              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[styles.toggleButton, !useCustomPart && styles.toggleButtonActive]}
                  onPress={() => setUseCustomPart(false)}
                >
                  <Text style={[styles.toggleText, !useCustomPart && styles.toggleTextActive]}>
                    Del Almacén
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, useCustomPart && styles.toggleButtonActive]}
                  onPress={() => setUseCustomPart(true)}
                >
                  <Text style={[styles.toggleText, useCustomPart && styles.toggleTextActive]}>
                    Escribir Libre
                  </Text>
                </TouchableOpacity>
              </View>

              {!useCustomPart ? (
                <>
                  <Text style={styles.inputLabel}>Recambio del Almacén</Text>
                  {almacenItems.length > 0 ? (
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={formData.almacen_id}
                        onValueChange={(value) => setFormData({ ...formData, almacen_id: value })}
                        style={styles.picker}
                        dropdownIconColor="#9CA3AF"
                      >
                        <Picker.Item label="Selecciona un recambio" value="" color="#6B7280" />
                        {almacenItems.map((item) => (
                          <Picker.Item
                            key={item.almacen_id}
                            label={`${item.recambio} (${item.marca})`}
                            value={item.almacen_id}
                            color="#FFFFFF"
                          />
                        ))}
                      </Picker>
                    </View>
                  ) : (
                    <Text style={styles.warningText}>
                      No hay recambios pendientes en el almacén
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>Recambio Instalado</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.recambio_instalado}
                    onChangeText={(text) => setFormData({ ...formData, recambio_instalado: text })}
                    placeholder="Filtro de aceite Bosch"
                    placeholderTextColor="#6B7280"
                  />
                </>
              )}

              <Text style={styles.inputLabel}>Notas Técnicas (Opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notas}
                onChangeText={(text) => setFormData({ ...formData, notas: text })}
                placeholder="Detalles del trabajo realizado..."
                placeholderTextColor="#6B7280"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>Guardar Trabajo</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  deleteButton: {
    padding: 4,
  },
  cardContent: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  value: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  notesContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#0A0A0A',
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#9CA3AF',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  form: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  textArea: {
    minHeight: 100,
  },
  pickerContainer: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    color: '#FFFFFF',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#0A0A0A',
    borderRadius: 8,
    padding: 4,
    marginTop: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#4285F4',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  warningText: {
    fontSize: 14,
    color: '#F59E0B',
    fontStyle: 'italic',
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: '#4285F4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
