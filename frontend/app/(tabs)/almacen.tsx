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

interface AlmacenItem {
  almacen_id: string;
  fecha_compra: string;
  recambio: string;
  marca: string;
  coste_euros: number;
  estado: string;
}

export default function AlmacenScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AlmacenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    fecha_compra: new Date().toISOString().split('T')[0],
    recambio: '',
    marca: '',
    coste_euros: '',
    estado: 'Pendiente',
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
    } catch (error) {
      console.error('Auth check error:', error);
      router.replace('/');
    }
  };

  const fetchItems = async () => {
    try {
      const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/almacen`, {
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

  const handleRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  const handleSubmit = async () => {
    try {
      const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/almacen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          coste_euros: parseFloat(formData.coste_euros),
        }),
      });

      if (response.ok) {
        setModalVisible(false);
        resetForm();
        fetchItems();
      }
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Eliminar recambio',
      '¿Estás seguro de que quieres eliminar este recambio?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
              const response = await fetch(`${backendUrl}/api/almacen/${id}`, {
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
      fecha_compra: new Date().toISOString().split('T')[0],
      recambio: '',
      marca: '',
      coste_euros: '',
      estado: 'Pendiente',
    });
  };

  const renderItem = ({ item }: { item: AlmacenItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.recambio}</Text>
          <Text style={styles.cardSubtitle}>{item.marca}</Text>
        </View>
        <View style={styles.statusBadge}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: item.estado === 'Instalado' ? '#10B981' : '#F59E0B' },
            ]}
          />
          <Text style={styles.statusText}>{item.estado}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(item.almacen_id)}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.row}>
          <Text style={styles.label}>Fecha de Compra:</Text>
          <Text style={styles.value}>{item.fecha_compra}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.labelBold}>Coste:</Text>
          <Text style={styles.valueBold}>{item.coste_euros.toFixed(2)} €</Text>
        </View>
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
        keyExtractor={(item) => item.almacen_id}
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
            <Ionicons name="cube-outline" size={64} color="#6B7280" />
            <Text style={styles.emptyText}>No hay recambios en almacén</Text>
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
              <Text style={styles.modalTitle}>Nuevo Recambio</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form}>
              <Text style={styles.inputLabel}>Fecha de Compra</Text>
              <TextInput
                style={styles.input}
                value={formData.fecha_compra}
                onChangeText={(text) => setFormData({ ...formData, fecha_compra: text })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#6B7280"
              />

              <Text style={styles.inputLabel}>Recambio</Text>
              <TextInput
                style={styles.input}
                value={formData.recambio}
                onChangeText={(text) => setFormData({ ...formData, recambio: text })}
                placeholder="Filtro de aceite, pastillas de freno..."
                placeholderTextColor="#6B7280"
              />

              <Text style={styles.inputLabel}>Marca</Text>
              <TextInput
                style={styles.input}
                value={formData.marca}
                onChangeText={(text) => setFormData({ ...formData, marca: text })}
                placeholder="Bosch, Mann, etc."
                placeholderTextColor="#6B7280"
              />

              <Text style={styles.inputLabel}>Coste (€)</Text>
              <TextInput
                style={styles.input}
                value={formData.coste_euros}
                onChangeText={(text) => setFormData({ ...formData, coste_euros: text })}
                placeholder="25.50"
                placeholderTextColor="#6B7280"
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Estado</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.estado}
                  onValueChange={(value) => setFormData({ ...formData, estado: value })}
                  style={styles.picker}
                  dropdownIconColor="#9CA3AF"
                >
                  <Picker.Item label="Pendiente" value="Pendiente" color="#FFFFFF" />
                  <Picker.Item label="Instalado" value="Instalado" color="#FFFFFF" />
                </Picker>
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>Guardar Recambio</Text>
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
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
  labelBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  valueBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4285F4',
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
