package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"
	"google.golang.org/protobuf/types/dynamicpb"
)

// createTestMessage creates a test protobuf message with nested structure
// mimicking the cosmos.base.tendermint.v1beta1.GetLatestBlockResponse structure
func createTestMessage(t *testing.T) protoreflect.Message {
	t.Helper()

	// Create nested message descriptors similar to:
	// Response { height: string, sdk_block: Block { header: Header { height: string, chain_id: string } } }
	headerDesc := &descriptorpb.DescriptorProto{
		Name: proto.String("Header"),
		Field: []*descriptorpb.FieldDescriptorProto{
			{
				Name:   proto.String("height"),
				Number: proto.Int32(1),
				Type:   descriptorpb.FieldDescriptorProto_TYPE_STRING.Enum(),
			},
			{
				Name:   proto.String("chain_id"),
				Number: proto.Int32(2),
				Type:   descriptorpb.FieldDescriptorProto_TYPE_STRING.Enum(),
			},
		},
	}

	blockDesc := &descriptorpb.DescriptorProto{
		Name: proto.String("Block"),
		Field: []*descriptorpb.FieldDescriptorProto{
			{
				Name:     proto.String("header"),
				Number:   proto.Int32(1),
				Type:     descriptorpb.FieldDescriptorProto_TYPE_MESSAGE.Enum(),
				TypeName: proto.String(".test.Header"),
			},
		},
	}

	responseDesc := &descriptorpb.DescriptorProto{
		Name: proto.String("Response"),
		Field: []*descriptorpb.FieldDescriptorProto{
			{
				Name:   proto.String("height"),
				Number: proto.Int32(1),
				Type:   descriptorpb.FieldDescriptorProto_TYPE_STRING.Enum(),
			},
			{
				Name:     proto.String("sdk_block"),
				Number:   proto.Int32(2),
				Type:     descriptorpb.FieldDescriptorProto_TYPE_MESSAGE.Enum(),
				TypeName: proto.String(".test.Block"),
			},
		},
	}

	fileDesc := &descriptorpb.FileDescriptorProto{
		Name:        proto.String("test.proto"),
		Package:     proto.String("test"),
		MessageType: []*descriptorpb.DescriptorProto{headerDesc, blockDesc, responseDesc},
	}

	fd, err := protodesc.NewFile(fileDesc, nil)
	if err != nil {
		t.Fatalf("failed to create file descriptor: %v", err)
	}

	// Create dynamic message and populate it
	msgDesc := fd.Messages().ByName("Response")
	if msgDesc == nil {
		t.Fatal("Response message descriptor not found")
	}

	msg := dynamicpb.NewMessage(msgDesc)

	// Set flat field: height = "12345"
	heightField := msgDesc.Fields().ByName("height")
	msg.Set(heightField, protoreflect.ValueOfString("12345"))

	// Set nested fields: sdk_block.header.height = "67890"
	sdkBlockField := msgDesc.Fields().ByName("sdk_block")
	blockMsgDesc := sdkBlockField.Message()
	blockMsg := dynamicpb.NewMessage(blockMsgDesc)

	headerField := blockMsgDesc.Fields().ByName("header")
	headerMsgDesc := headerField.Message()
	headerMsg := dynamicpb.NewMessage(headerMsgDesc)

	nestedHeightField := headerMsgDesc.Fields().ByName("height")
	headerMsg.Set(nestedHeightField, protoreflect.ValueOfString("67890"))

	chainIdField := headerMsgDesc.Fields().ByName("chain_id")
	headerMsg.Set(chainIdField, protoreflect.ValueOfString("test-chain"))

	blockMsg.Set(headerField, protoreflect.ValueOfMessage(headerMsg))
	msg.Set(sdkBlockField, protoreflect.ValueOfMessage(blockMsg))

	return msg
}

func TestGetNestedField(t *testing.T) {
	msg := createTestMessage(t)

	cases := []struct {
		name      string
		fieldPath string
		wantValue string
		wantErr   string
	}{
		{
			name:      "flat field",
			fieldPath: "height",
			wantValue: "12345",
		},
		{
			name:      "nested field - two levels",
			fieldPath: "sdk_block.header",
			wantValue: "", // Message type, check existence not value
		},
		{
			name:      "nested field - three levels",
			fieldPath: "sdk_block.header.height",
			wantValue: "67890",
		},
		{
			name:      "nested field - different leaf",
			fieldPath: "sdk_block.header.chain_id",
			wantValue: "test-chain",
		},
		{
			name:      "non-existent field",
			fieldPath: "nonexistent",
			wantErr:   "field 'nonexistent' not found",
		},
		{
			name:      "non-existent nested field",
			fieldPath: "sdk_block.nonexistent",
			wantErr:   "field 'nonexistent' not found",
		},
		{
			name:      "navigate beyond non-message field",
			fieldPath: "height.something",
			wantErr:   "is not a message",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			val, err := getNestedField(msg, tc.fieldPath)
			if tc.wantErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tc.wantErr)
			} else {
				assert.NoError(t, err)
				if tc.wantValue != "" {
					assert.Equal(t, tc.wantValue, val.String())
				} else {
					// For message types, just verify it's valid
					assert.True(t, val.IsValid())
				}
			}
		})
	}
}

func TestParseMethodFullName(t *testing.T) {
	cases := []struct {
		name           string
		methodFullName string
		wantService    string
		wantMethod     string
		wantErr        string
	}{
		{
			name:           "standard format",
			methodFullName: "cosmos.tx.v1beta1.Service.GetBlockWithTxs",
			wantService:    "cosmos.tx.v1beta1.Service",
			wantMethod:     "GetBlockWithTxs",
		},
		{
			name:           "simple format",
			methodFullName: "service.Method",
			wantService:    "service",
			wantMethod:     "Method",
		},
		{
			name:           "empty string",
			methodFullName: "",
			wantErr:        "method full name is empty",
		},
		{
			name:           "no dot",
			methodFullName: "InvalidMethod",
			wantErr:        "no dot found",
		},
		{
			name:           "empty service",
			methodFullName: ".Method",
			wantErr:        "invalid method full name format",
		},
		{
			name:           "empty method",
			methodFullName: "service.",
			wantErr:        "invalid method full name format",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			service, method, err := ParseMethodFullName(tc.methodFullName)
			if tc.wantErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tc.wantErr)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tc.wantService, service)
				assert.Equal(t, tc.wantMethod, method)
			}
		})
	}
}
