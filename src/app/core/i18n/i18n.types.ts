/**
 * Type for translations.
 *
 * Hierarchical structure of translation keys.
 */
export interface Translations {
  errors: {
    provider_error: string;
    invalid_request: string;
    network_error: string;

    card_declined: string;
    expired_card: string;
    incorrect_cvc: string;
    incorrect_number: string;
    authentication_required: string;
    processing_error: string;

    order_id_required: string;
    currency_required: string;
    amount_invalid: string;
    method_type_required: string;
    card_token_required: string;
    intent_id_required: string;
    min_amount: string;

    stripe_error: string;
    paypal_error: string;
    stripe_unavailable: string;
    paypal_unavailable: string;

    paypal_invalid_request: string;
    paypal_permission_denied: string;
    paypal_resource_not_found: string;
    paypal_instrument_declined: string;
    paypal_order_not_approved: string;
    paypal_internal_error: string;
    paypal_auth_error: string;
  };

  messages: {
    payment_created: string;
    payment_confirmed: string;
    payment_canceled: string;
    payment_processing: string;

    bank_verification_required: string;
    spei_instructions: string;
    paypal_redirect_required: string;

    status_requires_payment_method: string;
    status_requires_confirmation: string;
    status_requires_action: string;
    status_processing: string;
    status_succeeded: string;
    status_failed: string;
    status_canceled: string;
  };

  ui: {
    // Componentes UI
    loading: string;
    error: string;
    success: string;
    cancel: string;
    confirm: string;
    retry: string;
    back: string;
    next: string;

    // Formularios
    select_provider: string;
    select_method: string;
    enter_amount: string;
    enter_order_id: string;

    // Fallback
    fallback_available: string;
    fallback_question: string;
    fallback_accept: string;
    fallback_cancel: string;
    fallback_auto_executing: string;

    // Errores y mensajes
    unknown_error: string;
    payment_error: string;
    payment_completed: string;
    payment_started_successfully: string;
    intent_id: string;
    provider: string;
    status: string;
    amount: string;
    view_technical_details: string;
    try_again: string;
    view_full_response: string;
    new_payment: string;
    error_code: string;

    // Fallback modal
    payment_problem: string;
    provider_unavailable: string;
    try_another_provider: string;
    retry_with: string;

    // SPEI
    spei_transfer: string;
    make_transfer_with_data: string;
    reference: string;
    exact_amount: string;
    destination_bank: string;
    beneficiary: string;
    reference_expires: string;
    copy: string;
    copied: string;
    transfer_exact_amount: string;
    payment_may_take: string;
    keep_receipt: string;

    // 3DS
    '3ds_verification_required': string;
    bank_requires_verification: string;
    '3ds_version': string;
    complete_verification: string;

    // PayPal
    paypal_approval_required: string;
    redirected_to_paypal: string;
    order_id: string;
    go_to_paypal: string;
    after_approve_verify: string;

    // Acciones
    action_required: string;
    action_requires_attention: string;
    view_action_details: string;

    // Páginas
    checkout: string;
    payment_system: string;
    view_history: string;
    check_status: string;
    showcase: string;
    payment_provider: string;
    payment_method: string;
    payment_data: string;
    consult_status: string;
    enter_payment_id: string;
    intent_id_placeholder: string;
    example_stripe: string;
    consulting: string;
    error_consulting: string;
    result: string;
    quick_examples: string;
    stripe_intent: string;
    paypal_order: string;

    provider_stripe: string;
    provider_paypal: string;
    provider_stripe_description: string;
    provider_paypal_description: string;

    method_card: string;
    method_card_description: string;
    method_spei: string;
    method_spei_description: string;

    language: string;
    select_language: string;
    spanish: string;
    english: string;
    app_name: string;

    processing: string;
    payment_successful: string;
    payment_error_text: string;
    pay_with: string;
    with: string;

    provider_label: string;
    status_label: string;
    amount_label: string;
    action_required_label: string;
    confirm_button: string;
    cancel_button: string;

    spei_instructions_title: string;
    spei_step_1: string;
    spei_step_2: string;
    spei_step_3: string;
    spei_step_4: string;
    spei_step_5: string;
    spei_step_6: string;
    spei_deadline: string;
    spei_processing_time: string;
    stripe_beneficiary: string;
    order_summary: string;
    subtotal: string;
    total: string;
    enter_card_data: string;
    payment_method_label: string;
    card_payment_description: string;
    save_card_future: string;
    card_token: string;
    payment_history: string;
    clear_history: string;
    payments_in_session: string;
    new_payment_button: string;
    no_payments_history: string;
    payments_will_appear: string;
    make_payment: string;
    spei_bank_transfer: string;
    spei_email_instructions: string;
    email_label: string;
    field_required: string;
    check_by_id: string;
    select_provider_method: string;
    method_no_additional_data: string;
    select_provider_for_methods: string;
    payment_canceled: string;
    payment_canceled_message: string;
    payment_completed_message: string;
    verifying_payment: string;
    verifying_payment_message: string;
    return_information: string;
    payment_status: string;
    retry_payment: string;
    view_all_params: string;
    flow_type: string;
    flow_unknown: string;
    canceled: string;
    completed: string;

    debug_info: string;
    provider_debug: string;
    method_debug: string;
    form_valid: string;
    loading_debug: string;

    component_showcase: string;
    component_showcase_description: string;
    go_to_checkout: string;
    preview: string;
    controls: string;
    selected: string;
    disabled: string;
    show_items_breakdown: string;
    show_success_state: string;
    open_fallback_modal: string;
    fallback_modal_info: string;
    amount_label_short: string;
    currency_label: string;
    clabe_label: string;
    status_label_short: string;
    show_actions: string;
    expanded: string;
    info: string;

    client_secret: string;
    redirect_url: string;
    id_label: string;
    paypal_token: string;
    paypal_payer_id: string;
    pay_with_paypal: string;
    return_url_label: string;
    cancel_url_label: string;
    paypal_redirect_secure_message: string;
  };
}
