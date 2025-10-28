import {
    registerDecorator,
    ValidationOptions,
    ValidationArguments,
} from 'class-validator';

export function IsEndDateAfterStartDate(
    property: string,
    validationOptions?: ValidationOptions,
) {
    return function (object: Record<string, any>, propertyName: string) {
        registerDecorator({
            name: 'isEndDateAfterStartDate',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [property],
            validator: {
                validate(value: any, args: ValidationArguments) {
                    const [relatedPropertyName] = args.constraints;
                    const relatedValue = (args.object as any)[
                        relatedPropertyName
                    ];
                    if (!relatedValue || !value) return true;
                    return new Date(value) >= new Date(relatedValue);
                },
                defaultMessage(args: ValidationArguments) {
                    return `endDate must be later than startDate`;
                },
            },
        });
    };
}
