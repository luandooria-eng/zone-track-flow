import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { GridRow } from '@/types/dailyGrid';

interface SaveResult {
  success: boolean;
  orderId?: string;
  error?: string;
  warning?: string; // Warning message (e.g., Crediário without registered customer)
}

export async function saveGridRowToSupabase(row: GridRow): Promise<SaveResult> {
  try {
    // For existing orders, we only require customer name for updates
    // New orders require full data
    const isExistingOrder = Boolean(row.order_id);
    
    if (!isExistingOrder) {
      // Skip empty rows for new orders
      if (!row.customerName || !row.productName || row.quantity <= 0) {
        return { success: false, error: 'Dados incompletos' };
      }
    } else {
      // For existing orders, only require customer name
      if (!row.customerName) {
        return { success: false, error: 'Nome do cliente é obrigatório' };
      }
    }

    // Check if customer is S.ID (unidentified) - don't create customer
    const isUnidentified = ['s.id', 'sid', 's. id', 'sem identificação', 'sem identificacao']
      .some(term => row.customerName.toLowerCase().trim() === term);

    let customerId: string | null = null;
    let customerNotRegistered = false;
    
    if (!isUnidentified && row.customerName) {
      // First try to find existing customer by name
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .ilike('name', row.customerName)
        .limit(1);
      
      if (customers && customers.length > 0) {
        customerId = customers[0].id;
      } else {
        // Customer not found - mark as not registered (for Crediário warning)
        customerNotRegistered = true;
        console.log(`[SAVE] Cliente "${row.customerName}" não cadastrado - venda será salva como warning`);
      }
    }

    // Resolve product ID and get price - PRIORITY: use unitPrice from UI (includes channel fees)
    let productId: string | null = null;
    const hasUIPrice = row.unitPrice > 0;
    let productPrice = hasUIPrice ? row.unitPrice : (row.value / (row.quantity || 1));
    const productNameTrimmed = row.productName?.trim() || '';

    // 1. FIRST PRIORITY: Use product_id if available (set by UI selection)
    if (row.product_id) {
      const { data: product, error: productErr } = await supabase
        .from('products')
        .select('id, price, name')
        .eq('id', row.product_id)
        .maybeSingle();

      if (!productErr && product) {
        productId = product.id;
        // Only use DB price if UI didn't set a custom price (from channel/payment rules)
        if (!hasUIPrice) {
          productPrice = product.price ?? productPrice;
        }
        console.log(`[SAVE] Produto encontrado via ID: ${product.name} (${product.id}), unitPrice: ${productPrice}`);
      } else {
        console.warn(`[SAVE] product_id ${row.product_id} não encontrado, tentando por nome...`);
      }
    }

    // 2. SECOND PRIORITY: Search by exact name match (case-insensitive)
    if (!productId && productNameTrimmed) {
      const { data: products, error: nameErr } = await supabase
        .from('products')
        .select('id, price, name')
        .ilike('name', productNameTrimmed)
        .eq('is_active', true)
        .limit(1);

      if (!nameErr && products && products.length > 0) {
        productId = products[0].id;
        if (!hasUIPrice) productPrice = products[0].price ?? productPrice;
        console.log(`[SAVE] Produto encontrado via nome exato: ${products[0].name} (${products[0].id})`);
      }
    }

    // 3. THIRD PRIORITY: Search by partial name match (contains)
    if (!productId && productNameTrimmed) {
      const { data: products, error: partialErr } = await supabase
        .from('products')
        .select('id, price, name')
        .ilike('name', `%${productNameTrimmed}%`)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(1);

      if (!partialErr && products && products.length > 0) {
        productId = products[0].id;
        if (!hasUIPrice) productPrice = products[0].price ?? productPrice;
        console.log(`[SAVE] Produto encontrado via nome parcial: ${products[0].name} (${products[0].id})`);
      }
    }

    // 4. FINAL FALLBACK: Search by any product with similar start
    if (!productId && productNameTrimmed) {
      const firstWord = productNameTrimmed.split(' ')[0];
      if (firstWord.length >= 3) {
        const { data: products, error: fallbackErr } = await supabase
          .from('products')
          .select('id, price, name')
          .ilike('name', `${firstWord}%`)
          .eq('is_active', true)
          .order('name', { ascending: true })
          .limit(1);

        if (!fallbackErr && products && products.length > 0) {
          productId = products[0].id;
          if (!hasUIPrice) productPrice = products[0].price ?? productPrice;
          console.log(`[SAVE] Produto encontrado via primeira palavra: ${products[0].name} (${products[0].id})`);
        }
      }
    }

    // If still no product found
    if (!productId) {
      // For existing orders, we can skip product requirement if just updating payment/status
      if (isExistingOrder && !productNameTrimmed) {
        console.log('[SAVE] Pedido existente sem alteração de produto, mantendo item atual');
      } else if (isExistingOrder) {
        console.warn(`[SAVE] Produto não encontrado para pedido existente: "${productNameTrimmed}"`);
        // Allow update to proceed without changing product - we'll just not update order_items
      } else {
        // New orders MUST have a valid product
        console.error(`[SAVE] Produto não encontrado. ID: ${row.product_id}, Nome: "${productNameTrimmed}"`);
        return { 
          success: false, 
          error: `Produto não encontrado: "${productNameTrimmed}". Verifique se o produto existe e está ativo.` 
        };
      }
    }

    let paymentMethodId: string | null = null;
    if (row.paymentMethod) {
      const paymentMethodName = row.paymentMethod.trim();
      console.log(`[SAVE] Buscando método de pagamento: "${paymentMethodName}" (length: ${paymentMethodName.length})`);
      
      // First try exact match with active methods only
      const { data: methods, error: methodErr } = await supabase
        .from('payment_methods')
        .select('id, name, is_credit, is_active')
        .eq('is_active', true)
        .order('name');
      
      if (methodErr) {
        console.error('[SAVE] Erro ao buscar métodos de pagamento:', methodErr);
      } else if (methods && methods.length > 0) {
        console.log(`[SAVE] Métodos disponíveis:`, methods.map(m => `"${m.name}" (${m.id})`));
        
        // Find exact match (case-insensitive)
        const exactMatch = methods.find(m => 
          m.name.toLowerCase().trim() === paymentMethodName.toLowerCase()
        );
        
        if (exactMatch) {
          paymentMethodId = exactMatch.id;
          console.log(`[SAVE] Método de pagamento encontrado (exact): "${exactMatch.name}" -> ${exactMatch.id}`);
        } else {
          // Try partial match
          const partialMatch = methods.find(m => 
            m.name.toLowerCase().trim().includes(paymentMethodName.toLowerCase()) ||
            paymentMethodName.toLowerCase().includes(m.name.toLowerCase().trim())
          );
          
          if (partialMatch) {
            paymentMethodId = partialMatch.id;
            console.log(`[SAVE] Método de pagamento encontrado (partial): "${partialMatch.name}" -> ${partialMatch.id}`);
          } else {
            console.warn(`[SAVE] Método de pagamento não encontrado entre ativos: "${paymentMethodName}"`);
          }
        }
      }
      
      // Fallback: try all methods including inactive
      if (!paymentMethodId) {
        const { data: allMethods } = await supabase
          .from('payment_methods')
          .select('id, name, is_credit')
          .order('name');
        
        if (allMethods && allMethods.length > 0) {
          const match = allMethods.find(m => 
            m.name.toLowerCase().trim() === paymentMethodName.toLowerCase()
          );
          if (match) {
            paymentMethodId = match.id;
            console.log(`[SAVE] Método de pagamento (fallback): "${match.name}" -> ${match.id}`);
          }
        }
      }
      
      if (!paymentMethodId) {
        console.warn(`[SAVE] Método de pagamento definitivamente não encontrado: "${paymentMethodName}"`);
      }
    } else {
      console.log('[SAVE] Nenhum método de pagamento informado na linha');
    }

    // Resolve channel ID
    let channelId: string | null = null;
    if (row.channel) {
      const { data: channels } = await supabase
        .from('sales_channels')
        .select('id')
        .ilike('name', row.channel)
        .limit(1);
      
      if (channels && channels.length > 0) {
        channelId = channels[0].id;
      }
    }

    // Resolve delivery person ID
    let deliveryPersonId: string | null = null;
    if (row.deliverer) {
      const { data: deliverers } = await supabase
        .from('delivery_people')
        .select('id')
        .ilike('name', row.deliverer)
        .limit(1);
      
      if (deliverers && deliverers.length > 0) {
        deliveryPersonId = deliverers[0].id;
      }
    }

    // Resolve neighborhood ID
    let neighborhoodId: string | null = null;
    if (row.neighborhood) {
      const { data: neighborhoods } = await supabase
        .from('neighborhoods')
        .select('id')
        .ilike('name', row.neighborhood)
        .limit(1);
      
      if (neighborhoods && neighborhoods.length > 0) {
        neighborhoodId = neighborhoods[0].id;
        
        // Update customer with neighborhood if we just created them
        if (customerId) {
          await supabase
            .from('customers')
            .update({ neighborhood_id: neighborhoodId, street: row.address || null })
            .eq('id', customerId);
        }
      }
    }

    // Map status
    const statusMap: Record<string, 'accepted' | 'preparing' | 'sent' | 'delivered' | 'cancelled'> = {
      'Aceito': 'accepted',
      'Preparando': 'preparing',
      'Enviado': 'sent',
      'Entregue': 'delivered',
      'Cancelado': 'cancelled',
    };
    const orderStatus = statusMap[row.status] || 'accepted';

    // Calculate totals
    const subtotal = row.value;
    const total = subtotal;

    // Check if order already exists (update scenario)
    if (row.order_id) {
      const { data: existingOrder, error: checkError } = await supabase
        .from('orders')
        .select('id')
        .eq('id', row.order_id)
        .maybeSingle();

      if (checkError) throw new Error('Erro ao verificar pedido: ' + checkError.message);

      if (existingOrder) {
        // Update existing order
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            customer_id: customerId,
            payment_method_id: paymentMethodId,
            channel_id: channelId,
            delivery_person_id: deliveryPersonId,
            neighborhood_id: neighborhoodId,
            status: orderStatus,
            subtotal,
            total,
            delivery_address: row.address,
            delivery_number: row.houseNumber || null,
            delivery_reference: row.addressNotes || null,
            due_date: row.dueDate || null,
            notes: `Atualizado via Vendas Diárias em ${new Date().toLocaleString('pt-BR')}`,
          })
          .eq('id', row.order_id);

        if (updateError) throw new Error('Erro ao atualizar pedido: ' + updateError.message);

        // Only update order_items if we have a valid productId
        if (productId) {
          const { data: existingItems, error: itemsErr } = await supabase
            .from('order_items')
            .select('id')
            .eq('order_id', row.order_id)
            .order('created_at', { ascending: true })
            .limit(1);

          if (itemsErr) throw new Error('Erro ao buscar itens do pedido: ' + itemsErr.message);

          if (existingItems && existingItems.length > 0) {
            const { error: itemUpdateErr } = await supabase
              .from('order_items')
              .update({
                product_id: productId,
                quantity: row.quantity,
                unit_price: productPrice,
                total_price: row.value,
              })
              .eq('id', existingItems[0].id);

            if (itemUpdateErr) throw new Error('Erro ao atualizar item do pedido: ' + itemUpdateErr.message);
          } else {
            const { error: itemInsertErr } = await supabase
              .from('order_items')
              .insert({
                order_id: row.order_id,
                product_id: productId,
                quantity: row.quantity,
                unit_price: productPrice,
                total_price: row.value,
              });

            if (itemInsertErr) throw new Error('Erro ao criar item do pedido: ' + itemInsertErr.message);
          }
        } else {
          console.log('[SAVE] Sem productId, mantendo itens existentes do pedido');
        }

        // Check for Crediário without registered customer warning
        const isCrediario = row.paymentMethod?.toLowerCase().includes('credi');
        const warning = (isCrediario && customerNotRegistered) 
          ? `Cliente "${row.customerName}" não cadastrado - cadastre para controle de crédito` 
          : undefined;
        
        return { success: true, orderId: row.order_id, warning };
      }
    }

    // Create new order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customerId,
        payment_method_id: paymentMethodId,
        channel_id: channelId,
        delivery_person_id: deliveryPersonId,
        neighborhood_id: neighborhoodId,
        status: orderStatus,
        subtotal,
        total,
        delivery_address: row.address,
        delivery_number: row.houseNumber || null,
        delivery_reference: row.addressNotes || null,
        due_date: row.dueDate || null,
        notes: `Criado via Vendas Diárias em ${new Date().toLocaleString('pt-BR')}`,
      })
      .select('id')
      .single();

    if (orderError) throw new Error('Erro ao criar pedido: ' + orderError.message);

    // Create order item (this triggers stock deduction via database trigger)
    const { error: itemError } = await supabase
      .from('order_items')
      .insert({
        order_id: orderData.id,
        product_id: productId,
        quantity: row.quantity,
        unit_price: productPrice,
        total_price: row.value,
      });

    if (itemError) throw new Error('Erro ao criar item do pedido: ' + itemError.message);

    // Check for Crediário without registered customer warning
    const isCrediario = row.paymentMethod?.toLowerCase().includes('credi');
    const warning = (isCrediario && customerNotRegistered) 
      ? `Cliente "${row.customerName}" não cadastrado - cadastre para controle de crédito` 
      : undefined;

    return { success: true, orderId: orderData.id, warning };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao salvar linha:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function saveBatchToSupabase(rows: GridRow[]): Promise<{
  successCount: number;
  failedCount: number;
  results: SaveResult[];
}> {
  const results: SaveResult[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (const row of rows) {
    const result = await saveGridRowToSupabase(row);
    results.push(result);
    
    if (result.success) {
      successCount++;
    } else {
      failedCount++;
    }
  }

  if (successCount > 0) {
    toast.success(`${successCount} pedido(s) salvo(s) com sucesso!`);
  }
  if (failedCount > 0) {
    toast.error(`${failedCount} pedido(s) falharam ao salvar`);
  }

  return { successCount, failedCount, results };
}
