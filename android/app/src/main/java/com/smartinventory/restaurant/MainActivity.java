package com.smartinventory.restaurant;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PdfBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
